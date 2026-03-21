const pool = require('../db/pool');
async function fallbackToPreviousDay(source) {
  console.warn(`🔄 [${source}] 전일 데이터 폴백 처리 중...`);
  // pipeline_runs에 폴백 기록
  await pool.query(`
    INSERT INTO pipeline_runs (run_date, source, status, is_fallback, error_message)
    VALUES (CURRENT_DATE, $1, 'failed', TRUE, 'IP_BLOCKED_FALLBACK')
    ON CONFLICT (run_date, source) DO UPDATE SET
      status        = 'failed',
      is_fallback   = TRUE,
      error_message = 'IP_BLOCKED_FALLBACK',
      finished_at   = NOW()
  `, [source]);
  // 전일 스냅샷 → 오늘 날짜로 복사
  const { rowCount } = await pool.query(`
    INSERT INTO game_snapshots (
      app_id, snapshot_date, most_played_rank, concurrent_users,
      peak_users_today, is_new_entry_mp, collected_at
    )
    SELECT
      app_id,
      CURRENT_DATE,
      most_played_rank,
      concurrent_users,
      peak_users_today,
      FALSE,
      NOW()
    FROM game_snapshots
    WHERE snapshot_date = CURRENT_DATE - 1
      AND most_played_rank IS NOT NULL
    ON CONFLICT (app_id, snapshot_date) DO NOTHING
  `);
  console.warn(`🔄 전일 데이터 ${rowCount}개 복사 완료 (is_fallback=TRUE)`);
  return rowCount;
}
module.exports = { fallbackToPreviousDay };
