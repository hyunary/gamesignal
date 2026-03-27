const { collectAppDetails } = require('../src/collectors/steamApi');
const { retryWithBackoff } = require('../src/utils/retry');
const { fallbackToPreviousDay } = require('../src/utils/fallback');
const { sendPipelineAlert } = require('../src/notifications/discord');
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
// 동적 require (각 수집기)
const mostPlayed = require('../src/collectors/mostPlayed');
const wishlist   = require('../src/collectors/wishlist');
const reviews    = require('../src/collectors/reviews');
const { runSignalEngine } = require('../src/signals/engine');
async function runPipeline() {
  const startTime = Date.now();
  console.log('\n🚀 GameSignal 파이프라인 시작');
  console.log(`📅 실행 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`);
  console.log('═'.repeat(50));
  // 전체 타임아웃 60분
  const timeout = setTimeout(async () => {
    console.error('⏰ 파이프라인 타임아웃 (60분 초과)');
    await sendPipelineAlert('pipeline', '60분 타임아웃 초과');
    process.exit(1);
  }, 60 * 60 * 1000);
  try {
    // 1단계: Most Played 수집
    console.log('\n[1/5] Most Played Top 100 수집...');
    await retryWithBackoff(
      () => {
        // mostPlayed.js를 모듈로 사용
        const { chromium } = require('playwright-extra');
        const StealthPlugin = require('puppeteer-extra-plugin-stealth');
        const { upsertGame, upsertSnapshot, startPipelineRun, finishPipelineRun } = require('../src/db/queries');
        chromium.use(StealthPlugin());
        return require('../src/collectors/mostPlayed').scrapeMostPlayed
          ? require('../src/collectors/mostPlayed').scrapeMostPlayed()
          : Promise.resolve();
      },
      {
        label: 'most_played',
        onFail: async () => fallbackToPreviousDay('most_played')
      }
    ).catch(async () => {
      await sendPipelineAlert('most_played', 'IP 차단 또는 수집 실패');
    });
    // 2단계: Wishlist 수집
    console.log('\n[2/5] Wishlist Top 50 수집...');
    const { execSync } = require('child_process');
    await runStep('node src/collectors/mostPlayed.js', '1/5 Most Played');
    await runStep('node src/collectors/wishlist.js',   '2/5 Wishlist');
    await runStep('node src/collectors/reviews.js',    '3/5 리뷰');
    await runStep('node src/collectors/steamApi.js',   '4/5 appdetails');
    // 5단계: 신호 엔진
    console.log('\n[5/5] 신호 엔진 실행...');
    await runSignalEngine(new Date().toISOString().split('T')[0]);
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ 전체 파이프라인 완료 (${duration}초)`);
  } catch (err) {
    console.error('❌ 파이프라인 실패:', err.message);
    await sendPipelineAlert('pipeline', err.message);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
    process.exit(0);
  }
}
async function runStep(command, label) {
  const { execSync } = require('child_process');
  try {
    console.log(`\n[${label}] 실행 중...`);
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
  } catch (err) {
    console.error(`[${label}] 실패:`, err.message);
    await sendPipelineAlert(label, err.message);
  }
}
runPipeline();
