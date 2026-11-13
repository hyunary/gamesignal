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
  // 역대 첫 진입 여부 확인
  const { rows: histRows } = await pool.query(`
    SELECT COUNT(*) as cnt
    FROM game_snapshots
    WHERE app_id = $1
      AND snapshot_date < $2
      AND most_played_rank IS NOT NULL
  `, [appId, date]);
  const isFirstEver = parseInt(histRows[0].cnt) === 0;

  await pool.query(`
    INSERT INTO game_snapshots
      (app_id, snapshot_date, most_played_rank, concurrent_users,
       peak_users_today, is_new_entry_mp, is_first_ever_entry_mp)
    VALUES ($1, $2, $3, $4, $5,
      NOT EXISTS (
        SELECT 1 FROM game_snapshots
        WHERE app_id = $1
          AND snapshot_date = $2::date - 1
          AND most_played_rank IS NOT NULL
      ),
      $6
    )
    ON CONFLICT (app_id, snapshot_date) DO UPDATE SET
      most_played_rank       = EXCLUDED.most_played_rank,
      concurrent_users       = EXCLUDED.concurrent_users,
      peak_users_today       = EXCLUDED.peak_users_today,
      is_new_entry_mp        = EXCLUDED.is_new_entry_mp,
      is_first_ever_entry_mp = EXCLUDED.is_first_ever_entry_mp,
      collected_at           = NOW()
  `, [appId, date, rank, ccu, peak, isFirstEver]);
}
// pipeline_runs 시작 기록
async function startPipelineRun(source) {
  // KST 기준 오늘 날짜 (UTC+9)
  const now = new Date();
  const kstOffset = 9 * 60; // KST = UTC+9
  const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000);
  const today = kstTime.toISOString().split('T')[0];
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
// status: 'success' | 'partial' | 'failed' (run_status ENUM)
// rowsFailed는 선택 — 넘기지 않으면 기존 값 유지
async function finishPipelineRun(runId, status, rowsCollected, errorMessage = null, rowsFailed = null) {
  await pool.query(`
    UPDATE pipeline_runs SET
      status = $2,
      finished_at = NOW(),
      rows_collected = $3,
      error_message = $4,
      rows_failed = COALESCE($5, rows_failed)
    WHERE run_id = $1
  `, [runId, status, rowsCollected, errorMessage, rowsFailed]);
}
// 단계가 timeout/kill 등으로 finally에 도달하지 못했을 때
// 해당 날짜·소스의 'running' 행만 'failed'로 마감 (오케스트레이터 run.js에서 호출)
async function failStaleRuns(runDate, sources, errorMessage) {
  const { rowCount } = await pool.query(`
    UPDATE pipeline_runs SET
      status = 'failed',
      finished_at = NOW(),
      error_message = COALESCE(error_message, $3)
    WHERE run_date = $1::date
      AND source = ANY($2::text[])
      AND status = 'running'
  `, [runDate, sources, errorMessage]);
  return rowCount;
}
// 특정 날짜·소스의 pipeline_runs 상태 조회 (없으면 null)
// 신호 엔진이 당일 수집 단계 실패 여부를 보고 관련 신호 감지를 건너뛸 때 사용
// 같은 날 실행 기록이 여러 행이면 마지막(started_at 최신) 실행 기준
async function getRunStatus(runDate, source, db = pool) {
  const { rows } = await db.query(`
    SELECT status FROM pipeline_runs
    WHERE run_date = $1::date AND source = $2
    ORDER BY started_at DESC
    LIMIT 1
  `, [runDate, source]);
  return rows[0]?.status ?? null;
}
module.exports = { upsertGame, upsertSnapshot, startPipelineRun, finishPipelineRun, failStaleRuns, getRunStatus };
