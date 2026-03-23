const pool = require('../db/pool');
const { detectNewEntry }      = require('./signal1');
const { detectTrafficRevival } = require('./signal2');
const { detectWishlistSurge } = require('./signal3');
const { detectReviewSpike }   = require('./signal4');
const { detectComposite }     = require('./signal5');
const { startPipelineRun, finishPipelineRun } = require('../db/queries');
async function runSignalEngine(date) {
  const today = date || new Date().toISOString().split('T')[0];
  console.log(`\n🧠 신호 엔진 실행 시작 (기준일: ${today})\n`);
  const runId = await startPipelineRun('signal_engine');
  let totalSignals = 0;
  try {
    // S1 → S2 → S3 → S4 순서 실행 (S5는 반드시 마지막)
    totalSignals += await detectNewEntry(today);
    totalSignals += await detectTrafficRevival(today);
    totalSignals += await detectWishlistSurge(today);
    totalSignals += await detectReviewSpike(today);
    // S5: 복합 신호 (S1~S4 완료 후 실행)
    totalSignals += await detectComposite(today);
    await finishPipelineRun(runId, 'success', totalSignals);
    // 결과 요약
    console.log('\n' + '═'.repeat(50));
    console.log(`✅ 신호 엔진 완료 — 총 ${totalSignals}개 신호 생성`);
    console.log('═'.repeat(50));
    // 오늘 생성된 신호 목록 출력
    const { rows } = await pool.query(`
      SELECT
        s.signal_type as 신호,
        s.priority as 등급,
        g.title as 게임명,
        s.payload
      FROM signals s
      JOIN games g USING(app_id)
      WHERE s.signal_date = $1
      ORDER BY
        CASE s.priority WHEN 'P0' THEN 0 ELSE 1 END,
        s.created_at
    `, [today]);
    if (rows.length > 0) {
      console.log('\n📊 오늘의 신호:');
      rows.forEach(r => {
        console.log(`  [${r.등급}] ${r.신호.padEnd(15)} ${r.게임명}`);
      });
    } else {
      console.log('\n📊 오늘 감지된 신호 없음');
      console.log('   (데이터가 2일 이상 쌓이면 신호가 감지됩니다)');
    }
  } catch (err) {
    await finishPipelineRun(runId, 'failed', totalSignals, err.message);
    throw err;
  }
  return totalSignals;
}
module.exports = { runSignalEngine };
// 직접 실행 시
if (require.main === module) {
  runSignalEngine()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ 신호 엔진 실패:', err.message);
      process.exit(1);
    });
}
