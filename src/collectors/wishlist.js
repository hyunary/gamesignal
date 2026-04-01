const axios = require('axios');
const pool = require('../db/pool');
const { upsertGame, startPipelineRun, finishPipelineRun } = require('../db/queries');
const { retryWithBackoff } = require('../utils/retry');
const { fallbackToPreviousDay } = require('../utils/fallback');
const { sleep } = require('../utils/sleep');
require('dotenv').config();
async function fetchSteamSpyWishlist() {
  console.log('⭐ SteamSpy Wishlist 수집 시작...');
  // SteamSpy top100in2weeks API 호출
  const { data } = await axios.get('https://steamspy.com/api.php', {
    params: { request: 'top100in2weeks' },
    timeout: 15000
  });
  // ccu(현재 동시접속자) 내림차순 정렬 후 순위 부여
  const games = Object.entries(data)
    .map(([appId, info]) => ({
      appId: parseInt(appId),
      title: info.name,
      owners: info.owners,
      players2weeks: info.ccu || 0   // SteamSpy는 players_2weeks 미제공 → ccu 사용
    }))
    .sort((a, b) => b.players2weeks - a.players2weeks)
    .slice(0, 50)
    .map((g, index) => ({ ...g, rank: index + 1 }));
  console.log(`✅ ${games.length}개 게임 수집 완료`);
  // 상위 10개 미리보기
  console.log('\n📊 SteamSpy Top 10 미리보기:');
  console.log('순위 | 앱ID | 게임명 | 현재 동시접속자(CCU)');
  console.log('-----|------|--------|----------');
  games.slice(0, 10).forEach(g => {
    console.log(
      `${String(g.rank).padStart(3)}위 | ${g.appId} | ${g.title} | ${g.players2weeks.toLocaleString()}명`
    );
  });
  return games;
}
async function saveWishlistData(games) {
  console.log('\n💾 DB 저장 중...');
  // KST 기준 오늘 날짜 (UTC+9)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().split('T')[0];
  const runId = await startPipelineRun('wishlist');
  let saved = 0;
  for (const game of games) {
    try {
      // 게임 기본 정보 저장
      await upsertGame(game.appId, game.title);
      // 전일 wishlist_rank 조회 (rank_change_flag 계산용)
      const { rows } = await pool.query(`
        SELECT wishlist_rank FROM game_snapshots
        WHERE app_id = $1
          AND snapshot_date = $2::date - 1
      `, [game.appId, today]);
      const prevRank = rows[0]?.wishlist_rank ?? null;
      const isNewEntry = prevRank === null;
      // rank_change_flag 계산 (경계값: >= 5)
      let rankChangeFlag = null;
      if (prevRank !== null) {
        const delta = prevRank - game.rank;
        if (delta >= 5)       rankChangeFlag = 'surge';
        else if (delta <= -5) rankChangeFlag = 'drop';
        else                  rankChangeFlag = 'stable';
      }
      // 스냅샷 저장
      await pool.query(`
        INSERT INTO game_snapshots
          (app_id, snapshot_date, wishlist_rank, is_new_entry_wl, rank_change_flag)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (app_id, snapshot_date) DO UPDATE SET
          wishlist_rank    = EXCLUDED.wishlist_rank,
          is_new_entry_wl  = EXCLUDED.is_new_entry_wl,
          rank_change_flag = EXCLUDED.rank_change_flag,
          collected_at     = NOW()
      `, [game.appId, today, game.rank, isNewEntry, rankChangeFlag]);
      saved++;
    } catch (err) {
      console.error(`⚠️ 저장 실패 (${game.title}):`, err.message);
    }
  }
  await finishPipelineRun(runId, 'success', saved);
  console.log(`✅ ${saved}개 게임 DB 저장 완료`);
  return saved;
}
// 메인 실행
retryWithBackoff(
  async () => {
    const games = await fetchSteamSpyWishlist();
    await saveWishlistData(games);
    return games;
  },
  {
    label: 'wishlist',
    onFail: async () => {
      console.error('❌ 최종 실패 — 전일 데이터 폴백 실행');
      await fallbackToPreviousDay('wishlist');
    }
  }
)
  .then(games => {
    if (games) console.log(`\n🎉 완료! Wishlist ${games.length}개 수집 및 저장됨`);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ 파이프라인 실패:', err.message);
    process.exit(1);
  });
