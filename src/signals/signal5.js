const pool = require('../db/pool');
const { emitSignal } = require('./emit');
async function detectComposite(today) {
  console.log('  [S5] 복합 신호 감지 중...');
  // 오늘 2개 이상 신호가 발생한 게임 조회
  const { rows } = await pool.query(`
    SELECT
      app_id,
      ARRAY_AGG(signal_type::text ORDER BY signal_type) as types,
      COUNT(*) as signal_count
    FROM signals
    WHERE signal_date = $1
      AND signal_type != 'composite'
    GROUP BY app_id
    HAVING COUNT(*) >= 2
  `, [today]);
  console.log(`  [S5] 복합 신호 후보: ${rows.length}개`);
  let emitted = 0;
  for (const row of rows) {
    const ok = await emitSignal(
      row.app_id, today, 'composite', 'P1',
      { composite_types: row.types, signal_count: parseInt(row.signal_count) },
      row.types  // composite_types 컬럼
    );
    if (ok) {
      console.log(`    ✅ composite: app_id=${row.app_id} [${row.types.join(' + ')}]`);
      emitted++;
    }
  }
  console.log(`  [S5] 완료: ${emitted}개 복합 신호 생성`);
  return emitted;
}
module.exports = { detectComposite };
