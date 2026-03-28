const pool = require('./pool');
// 게임 기본 정보 UPSERT (없으면 삽입, 있으면 제목만 업데이트)
async function upsertGame(appId, title) {
  await pool.query(`
    INSERT INTO games (app_id, title)
    VALUES ($1, $2)
    ON CONFLICT (app_id) DO UPDATE SET
      title = EXCLUDED.title,
      updated_at = NOW()
  `, [appId, title]);
}
// 스냅샷 UPSERT + 신규 진입 자동 감지
async function upsertSnapshot(appId, rank, ccu, peak, date) {
  await pool.query(`
    INSERT INTO game_snapshots
      (app_id, snapshot_date, most_played_rank, concurrent_users,
       peak_users_today, is_new_entry_mp)
    VALUES ($1, $2, $3, $4, $5,
      NOT EXISTS (
        SELECT 1 FROM game_snapshots
        WHERE app_id = $1
          AND snapshot_date = $2::date - 1
          AND most_played_rank IS NOT NULL
      )
    )
    ON CONFLICT (app_id, snapshot_date) DO UPDATE SET
      most_played_rank = EXCLUDED.most_played_rank,
      concurrent_users = EXCLUDED.concurrent_users,
      peak_users_today = EXCLUDED.peak_users_today,
      is_new_entry_mp  = EXCLUDED.is_new_entry_mp,
      collected_at     = NOW()
  `, [appId, date, rank, ccu, peak]);
}
// pipeline_runs 시작 기록
async function startPipelineRun(source) {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await pool.query(`
    INSERT INTO pipeline_runs (run_date, source, status)
    VALUES ($1::date, $2, 'running')
    ON CONFLICT (run_date, source) DO UPDATE SET
      status = 'running',
      started_at = NOW(),
      retry_count = pipeline_runs.retry_count + 1
    RETURNING run_id
  `, [today, source]);
  return rows[0].run_id;
}
// pipeline_runs 완료 기록
async function finishPipelineRun(runId, status, rowsCollected, errorMessage = null) {
  await pool.query(`
    UPDATE pipeline_runs SET
      status = $2,
      finished_at = NOW(),
      rows_collected = $3,
      error_message = $4
    WHERE run_id = $1
  `, [runId, status, rowsCollected, errorMessage]);
}
module.exports = { upsertGame, upsertSnapshot, startPipelineRun, finishPipelineRun };
