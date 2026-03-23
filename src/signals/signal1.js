const pool = require('../db/pool');
const { shouldSuppress } = require('./filters');
const { emitSignal } = require('./emit');
async function detectNewEntry(today) {
  console.log('  [S1] 신규 진입 감지 중...');
  // 오늘 신규 진입한 게임 조회
  const { rows } = await pool.query(`
    SELECT
      s.app_id, g.title,
      s.most_played_rank, s.concurrent_users,
      s.wishlist_rank, s.is_new_entry_mp, s.is_new_entry_wl,
      g.genres
    FROM game_snapshots s
    JOIN games g USING(app_id)
    WHERE s.snapshot_date = $1
      AND (s.is_new_entry_mp = TRUE OR s.is_new_entry_wl = TRUE)
  `, [today]);
  console.log(`  [S1] 후보: ${rows.length}개`);
  let emitted = 0;
  for (const row of rows) {
    // Most Played 신규 진입
    if (row.is_new_entry_mp) {
      const suppress = await shouldSuppress(
        row.app_id, 'new_entry_mp', row.concurrent_users, today
      );
      if (suppress) {
        console.log(`    SUPPRESS(${suppress}): ${row.title}`);
        continue;
      }
      const ok = await emitSignal(row.app_id, today, 'new_entry_mp', 'P0', {
        rank: row.most_played_rank,
        concurrent_users: row.concurrent_users,
        genres: row.genres
      });
      if (ok) {
        console.log(`    ✅ new_entry_mp: ${row.title} (${row.most_played_rank}위)`);
        emitted++;
      }
    }
    // Wishlist 신규 진입
    if (row.is_new_entry_wl) {
      const suppress = await shouldSuppress(
        row.app_id, 'new_entry_wl', row.concurrent_users, today
      );
      if (suppress) continue;
      const ok = await emitSignal(row.app_id, today, 'new_entry_wl', 'P0', {
        wishlist_rank: row.wishlist_rank,
        genres: row.genres
      });
      if (ok) {
        console.log(`    ✅ new_entry_wl: ${row.title} (위시리스트 ${row.wishlist_rank}위)`);
        emitted++;
      }
    }
  }
  console.log(`  [S1] 완료: ${emitted}개 신호 생성`);
  return emitted;
}
module.exports = { detectNewEntry };
