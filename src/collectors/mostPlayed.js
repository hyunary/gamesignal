const axios = require('axios');
const { Pool } = require('pg');
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
const { upsertSnapshot, startPipelineRun, finishPipelineRun } = require('../db/queries');
const { retryWithBackoff } = require('../utils/retry');
const { fallbackToPreviousDay } = require('../utils/fallback');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Steam 공식 차트 API — IP 차단/페이지 구조 변경에 강함 (HTML 스크래핑 대체)
const MOST_PLAYED_URL =
  'https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/';

async function fetchMostPlayed() {
  console.log('🎮 Steam Most Played 수집 시작 (공식 API)...');

  if (!STEAM_API_KEY) {
    throw new Error('STEAM_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  console.log('📡 Steam 차트 API 호출 중...');
  const { data } = await axios.get(MOST_PLAYED_URL, {
    params: { key: STEAM_API_KEY },
    timeout: 15000,
  });

  // 응답 구조: { response: { rollup_date, ranks: [ { rank, appid, last_week_rank, peak_in_game }, ... ] } }
  // 주의: 이 API는 주간 차트(rollup_date 기준)이며 peak_in_game(주간 피크 동접)만 제공
  const ranks = data?.response?.ranks;
  if (!Array.isArray(ranks) || ranks.length === 0) {
    throw new Error('Most Played API 응답에 ranks 배열이 없음 — 구조 변경 의심');
  }

  const games = ranks
    .map((r) => ({
      rank: r.rank,
      appId: r.appid,
      ccu: r.peak_in_game ?? 0,   // 주간 피크 동접 (이 API는 실시간 동접 미제공)
      peak: r.peak_in_game ?? 0,
    }))
    .filter((g) => g.appId && g.rank >= 1 && g.rank <= 100)
    .slice(0, 100)
    .sort((a, b) => a.rank - b.rank);

  console.log(`✅ ${games.length}개 게임 수집 완료`);

  if (games.length === 0) {
    throw new Error('유효한 게임 데이터 0개 — API 응답 확인 필요');
  }

  // 상위 10개 미리보기 (게임명은 이후 steamApi.collectAppDetails에서 채워짐)
  console.log('\n📊 상위 10개 미리보기:');
  console.log('순위 | 앱ID | 주간피크 CCU');
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

// 메인 실행 (재시도 + 폴백 포함) — 기존 동작 유지
retryWithBackoff(fetchMostPlayed, {
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
