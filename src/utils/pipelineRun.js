/**
 * pipeline_runs 기록 래퍼 — 수집기 본문을 try/catch/finally로 감싸
 * 어떤 경로로 끝나든 'running'으로 남지 않게 한다.
 *
 * 사용법:
 *   await withPipelineRun('reviews', async (run) => {
 *     run.collected = 10; run.failed = 2;
 *     run.status = 'partial';            // 생략 시 deriveStatus()로 결정
 *     run.error  = '사유 요약';
 *   });
 *
 * 본문이 throw하면 status='failed' + error_message=err.message로 마감한 뒤 rethrow.
 * deps는 테스트용 주입 (기본: db/queries).
 */

// 수집 결과로 상태 결정: 0건이면 failed, 일부 실패/건너뜀이면 partial
function deriveStatus({ collected = 0, failed = 0, skipped = 0, expected = null }) {
  if (expected === 0) return 'success';          // 대상 자체가 없음 (예: 신규 게임 없음)
  if (collected === 0) return 'failed';          // 하나도 못 모음 → 성공 아님
  if (failed > 0 || skipped > 0) return 'partial';
  return 'success';
}

async function withPipelineRun(source, body, deps = null) {
  const { startPipelineRun, finishPipelineRun } = deps || require('../db/queries');
  const run = { collected: 0, failed: 0, skipped: 0, expected: null, status: null, error: null };
  const runId = await startPipelineRun(source);
  let thrown = null;
  try {
    const result = await body(run);
    return result;
  } catch (err) {
    thrown = err;
    throw err;
  } finally {
    const status = thrown ? 'failed' : (run.status || deriveStatus(run));
    const error  = thrown ? (thrown.message || String(thrown)) : run.error;
    try {
      await finishPipelineRun(runId, status, run.collected, error ? String(error).slice(0, 2000) : null, run.failed);
      console.log(`📝 pipeline_runs[${source}] → ${status} (수집 ${run.collected} / 실패 ${run.failed} / 건너뜀 ${run.skipped})`);
    } catch (e) {
      // 기록 실패가 원래 에러를 가리지 않도록 로그만 남김
      console.error(`⚠️ pipeline_runs[${source}] 마감 기록 실패: ${e.message}`);
    }
  }
}

module.exports = { withPipelineRun, deriveStatus };
