const pool = require('../db/pool');
const { emitSignal } = require('./emit');
async function detectReviewSpike(today) {
  console.log('  [S4] 리뷰 급증 감지 중...');
  const { rows } = await pool.query(`
    SELECT
      s.app_id, g.title,
      s.review_30d, s.review_total,
      s.review_positive
    FROM game_snapshots s
    JOIN games g USING(app_id)
    WHERE s.snapshot_date = $1
      AND s.review_spike = TRUE
      AND s.review_total >= 100
      AND g.is_adult_only = FALSE
      AND g.is_dlc = FALSE
  `, [today]);
  let emitted = 0;
  for (const row of rows) {
    // 전일 review_30d 조회 (증가율 계산용)
    const { rows: prevRows } = await pool.query(`
      SELECT review_30d FROM game_snapshots
      WHERE app_id = $1 AND snapshot_date = $2::date - 1
    `, [row.app_id, today]);
    const prev30d   = prevRows[0]?.review_30d ?? 0;
    const reviewPct = prev30d > 0
      ? ((row.review_30d / prev30d - 1) * 100).toFixed(1)
      : null;
    const posPct = row.review_total > 0
      ? ((row.review_positive / row.review_total) * 100).toFixed(1)
      : null;
    const ok = await emitSignal(row.app_id, today, 'review_spike', 'P1', {
      review_30d:  row.review_30d,
      review_pct:  reviewPct ? parseFloat(reviewPct) : null,
      pos_pct:     posPct    ? parseFloat(posPct)    : null
    });
    if (ok) {
      console.log(`    ✅ review_spike: ${row.title} (+${reviewPct}%, 긍정률 ${posPct}%)`);
      emitted++;
    }
  }
  console.log(`  [S4] 완료: ${emitted}개 신호 생성`);
  return emitted;
}
module.exports = { detectReviewSpike };
