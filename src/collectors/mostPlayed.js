const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
const { upsertGame, upsertSnapshot, startPipelineRun, finishPipelineRun } = require('../db/queries');
const { retryWithBackoff } = require('../utils/retry');
const { fallbackToPreviousDay } = require('../utils/fallback');
chromium.use(StealthPlugin());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const UA_LIST = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
];
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function randomDelay() {
  const min = parseInt(process.env.SCRAPE_DELAY_MIN_MS) || 3000;
  const max = parseInt(process.env.SCRAPE_DELAY_MAX_MS) || 5000;
  return sleep(Math.floor(Math.random() * (max - min + 1)) + min);
}
async function scrapeMostPlayed() {
  console.log('🎮 Steam Most Played 스크래핑 시작...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: UA_LIST[Math.floor(Math.random() * UA_LIST.length)],
    viewport: { width: 1280, height: 800 }
  });
  const page = await context.newPage();
  // 이미지/폰트 차단 (속도 개선)
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', r => r.abort());
  try {
    console.log('📡 Steam 차트 페이지 접속 중...');
    await page.goto('https://store.steampowered.com/charts/mostplayed', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    // CAPTCHA / 차단 감지
    const pageTitle = await page.title();
    if (pageTitle.includes('Please verify') || pageTitle.includes('Access Denied')) {
      throw Object.assign(new Error('Steam IP 차단 감지'), { response: { status: 429 } });
    }
    await page.waitForTimeout(3000);
    console.log('🔍 페이지 파싱 중...');

    // 테이블 로딩 대기 (TR 행이 나타날 때까지)
    await page.waitForSelector('tr a[href*="/app/"]', { timeout: 30000 })
      .catch(() => console.log('⚠️ 테이블 로딩 대기 실패, 파싱 계속 시도...'));

    // 게임 목록 추출
    const games = await page.evaluate(() => {
      // TR 행 기반 파싱 (실제 Steam 페이지 구조)
      const rows = document.querySelectorAll('tr');

      const results = [];
      rows.forEach((row) => {
        try {
          // 앱 ID (링크에서 추출)
          const link = row.querySelector('a[href*="/app/"]');
          if (!link) return;
          const appIdMatch = link.href.match(/\/app\/(\d+)/);
          if (!appIdMatch) return;
          const appId = parseInt(appIdMatch[1]);

          // 게임 이름 — div._1n_4-zvf0n4aqGEksbgW9N 안에 있음
          const nameEl = row.querySelector('._1n_4-zvf0n4aqGEksbgW9N');
          const title = (nameEl ? nameEl.textContent.trim() : link.textContent.trim()) || `Game_${appId}`;

          // 순위 & CCU — TD 구조: [이미지] [순위] [이름] [가격] [현재접속] [피크]
          const tds = row.querySelectorAll('td');
          let rank = results.length + 1;
          let ccu = 0;

          tds.forEach((td, i) => {
            const txt = td.textContent.replace(/,/g, '').trim();
            const n = parseInt(txt);
            if (!isNaN(n)) {
              if (i === 1 && n >= 1 && n <= 100) rank = n;   // 두 번째 TD = 순위
              if (i === 5 && n > 0) ccu = n;                 // 여섯 번째 TD = 피크 CCU
              else if (i === 4 && n > 0 && ccu === 0) ccu = n; // 다섯 번째 TD = 현재 접속자
            }
          });

          if (appId && results.length < 100) {
            results.push({ rank, appId, title, ccu });
          }
        } catch (e) {}
      });

      return results.sort((a, b) => a.rank - b.rank);
    });
    console.log(`✅ ${games.length}개 게임 파싱 완료`);

    if (games.length === 0) {
      // 파싱 실패 시 페이지 구조 확인용 스크린샷
      await page.screenshot({ path: 'debug_screenshot.png' });
      console.log('📸 debug_screenshot.png 저장됨 - 페이지 구조 확인 필요');
      throw new Error('게임 데이터 파싱 실패 - 선택자 확인 필요');
    }
    // 상위 10개 미리보기 출력
    console.log('\n📊 상위 10개 미리보기:');
    console.log('순위 | 앱ID | 게임명 | CCU');
    console.log('-----|------|--------|----');
    games.slice(0, 10).forEach(g => {
      console.log(`${String(g.rank).padStart(3)}위 | ${g.appId} | ${g.title} | ${g.ccu.toLocaleString()}명`);
    });
    // DB 저장
    console.log('\n💾 DB 저장 중...');
    // KST 기준 오늘 날짜 (UTC+9)
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today = kst.toISOString().split('T')[0];
    const runId = await startPipelineRun('most_played');

    let saved = 0;
    for (const game of games) {
      try {
        await upsertGame(game.appId, game.title);
        await upsertSnapshot(game.appId, game.rank, game.ccu, game.ccu, today);
        saved++;
      } catch (err) {
        console.error(`⚠️ 저장 실패 (${game.title}):`, err.message);
      }
    }

    await finishPipelineRun(runId, 'success', saved);
    console.log(`✅ ${saved}개 게임 DB 저장 완료`);

    return games;
  } finally {
    await browser.close();
  }
}
// 메인 실행 (재시도 + 폴백 포함)
retryWithBackoff(scrapeMostPlayed, {
  maxRetries: 3,
  label: 'most_played',
  onFail: async (err) => {
    console.error('❌ 최종 실패 — 전일 데이터 폴백 실행');
    await fallbackToPreviousDay('most_played');
  }
})
  .then(games => {
    if (games) {
      console.log(`\n🎉 완료! 총 ${games.length}개 게임 수집 및 저장됨`);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 파이프라인 실패:', err.message);
    process.exit(1);
  });
