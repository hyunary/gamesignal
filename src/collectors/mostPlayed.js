const axios = require('axios');
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
const { upsertSnapshot, startPipelineRun, finishPipelineRun } = require('../db/queries');
const { retryWithBackoff } = require('../utils/retry');
const { fallbackToPreviousDay } = require('../utils/fallback');
const { sleep } = require('../utils/sleep');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const STEAM_API_KEY = process.env.STEAM_API_KEY;

// 1) 주간 Most Played 차트 — 신규 등장 게임 발굴용 (주 단위 갱신)
const MOST_PLAYED_URL =
  'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/';
// 2) 실시간 현재 동접 — 매일 변하는 CCU 소스 (키 불필요, 공개)
const CURRENT_PLAYERS_URL =
  'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/';

// 주간 차트에서 Top 100 appid 목록 (신규 게임 발굴용)
async function fetchChartAppIds() {
  if (!STEAM_API_KEY) {
    throw new Error('STEAM_API_KEY 환경변수가 설정되지 않았습니다.');
  }
  const { data } = await axios.get(MOST_PLAYED_URL, {
    params: { key: STEAM_API_KEY },
    timeout: 15000,
  });
  const ranks = data?.response?.ranks;
  if (!Array.isArray(ranks) || ranks.length === 0) {
    throw new Error('Most Played API 응답에 ranks 배열이 없음 — 구조 변경 의심');
  }
  return ranks.map((r) => r.appid).filter((id) => Number.isInteger(id));
}

// DB에 누적된 추적 게임 appid (후보 풀 확장용)
async function fetchTrackedAppIds() {
  const { rows } = await pool.query(`
    SELECT app_id FROM games
    WHERE is_dlc = FALSE AND is_software = FALSE AND is_adult_only = FALSE
  `);
  return rows.map((r) => r.app_id);
}

// appid의 실시간 현재 동접 조회 (키 불필요)
async function fetchCurrentPlayers(appId) {
  const { data } = await axios.get(CURRENT_PLAYERS_URL, {
    params: { appid: appId },
    timeout: 10000,
  });
  if (data?.response?.result !== 1) return null;
  return data.response.player_count ?? null;
}

async function scrapeMostPlayed() {
  console.log('🎮 Steam Most Played 수집 시작 (후보 풀 + 실시간 CCU)...');

  // 후보군 = 주간 차트 ∪ DB 누적 추적 게임 (중복 제거)
  console.log('📡 후보 풀 구성 중 (주간 차트 + DB 추적 게임)...');
  const [chartIds, trackedIds] = await Promise.all([
    fetchChartAppIds(),
    fetchTrackedAppIds(),
  ]);
  const candidates = [...new Set([...chartIds, ...trackedIds])];
  console.log(`✅ 후보 ${candidates.length}개 (주간 ${chartIds.length} + DB ${trackedIds.length}, 중복 제거) — 실시간 CCU 조회 시작`);

  // 각 후보의 실시간 CCU 조회 (호출 간 200ms 지연)
  const collected = [];
  let failed = 0;
  for (const appId of candidates) {
    try {
      const ccu = await retryWithBackoff(
        () => fetchCurrentPlayers(appId),
        { label: `players(${appId})`, maxRetries: 1, baseMs: 800 }
      );
      if (ccu !== null && ccu > 0) {
        collected.push({ appId, ccu });
      }
      await sleep(200);
    } catch (err) {
      failed++;
    }
  }

  if (collected.length === 0) {
    throw new Error('실시간 CCU 수집 0개 — API 응답 확인 필요');
  }

  // 실시간 CCU 기준 내림차순 정렬 → 상위 100개 = 오늘의 Top 100
  collected.sort((a, b) => b.ccu - a.ccu);
  const games = collected.slice(0, 100).map((g, i) => ({
    rank: i + 1,
    appId: g.appId,
    ccu: g.ccu,
    peak: g.ccu,
  }));

  console.log(`✅ 후보 ${collected.length}개 중 Top 100 선정 완료 (CCU 조회 실패 ${failed}개)`);

  // 상위 10개 미리보기
  console.log('\n📊 상위 10개 미리보기:');
  console.log('순위 | 앱ID | 실시간 CCU');
  console.log('-----|------|----');
  games.slice(0, 10).forEach((g) => {
    console.log(`${String(g.rank).padStart(3)}위 | ${g.appId} | ${g.ccu.toLocaleString()}명`);
  });

  // DB 저장 — KST 기준 오늘 날짜 (UTC+9)
  console.log('\n💾 DB 저장 중...');
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().split('T')[0];
  const runId = await startPipelineRun('most_played');

  let saved = 0;
  for (const game of games) {
    try {
      // 이름은 건드리지 않고 row만 보장 (기존 이름 보존, steamApi.js가 정식 이름 관리)
      await pool.query(
        `INSERT INTO games (app_id, title)
         VALUES ($1, $2)
         ON CONFLICT (app_id) DO NOTHING`,
        [game.appId, `Game_${game.appId}`]
      );
      await upsertSnapshot(game.appId, game.rank, game.ccu, game.peak, today);
      saved++;
    } catch (err) {
      console.error(`⚠️ 저장 실패 (appId ${game.appId}):`, err.message);
    }
  }

  await finishPipelineRun(runId, 'success', saved);
  console.log(`✅ ${saved}개 게임 DB 저장 완료`);

  return games;
}

// 메인 실행 (재시도 + 폴백 포함)
retryWithBackoff(scrapeMostPlayed, {
  maxRetries: 3,
  label: 'most_played',
  onFail: async (err) => {
    console.error('❌ 최종 실패 — 전일 데이터 폴백 실행:', err.message);
    await fallbackToPreviousDay('most_played');
  },
})
  .then(async (games) => {
    if (games) {
      console.log(`\n🎉 완료! 총 ${games.length}개 게임 수집 및 저장됨`);
    }
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('❌ 실패:', err.message);
    await pool.end();
    process.exit(1);
  });
