const pool = require('../db/pool');
const { shouldSuppress } = require('./filters');
const { emitSignal } = require('./emit');
async function detectWishlistSurge(today) {
  console.log('  [S3] 위시리스트 급등 감지 중...');
  const { rows } = await pool.query(`
    SELECT
      s.app_id, g.title,
      s.wishlist_rank, s.rank_change_flag,
      LAG(s.wishlist_rank) OVER (
        PARTITION BY s.app_id ORDER BY s.snapshot_date
      ) as prev_rank
    FROM game_snapshots s
    JOIN games g USING(app_id)
    WHERE s.snapshot_date = $1
      AND s.rank_change_flag = 'surge'
  `, [today]);
  let emitted = 0;
  for (const row of rows) {
    const suppress = await shouldSuppress(row.app_id, 'wishlist_surge', null, today);
    if (suppress) {
      console.log(`    SUPPRESS(${suppress}): ${row.title}`);
      continue;
    }
    // 전일 wishlist_rank 조회
    const { rows: prevRows } = await pool.query(`
      SELECT wishlist_rank FROM game_snapshots
      WHERE app_id = $1 AND snapshot_date = $2::date - 1
    `, [row.app_id, today]);
    const prevRank = prevRows[0]?.wishlist_rank ?? null;
    const change   = prevRank ? prevRank - row.wishlist_rank : null;
    const ok = await emitSignal(row.app_id, today, 'wishlist_surge', 'P0', {
      curr_rank: row.wishlist_rank,
      prev_rank: prevRank,
      change
    });
    if (ok) {
      console.log(`    ✅ wishlist_surge: ${row.title} (${prevRank}위→${row.wishlist_rank}위, +${change}계단)`);
      emitted++;
    }
  }
  console.log(`  [S3] 완료: ${emitted}개 신호 생성`);
  return emitted;
}
module.exports = { detectWishlistSurge };
