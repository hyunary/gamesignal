const pool = require('../db/pool');
const { emitSignal } = require('./emit');

// ── Spike 판정 임계값 ──────────────────────────────────────────────
const MIN_DAILY_INCREMENT = 50;   // 당일 신규 리뷰 최소 건수 (노이즈 하한)
const ACCEL_MULTIPLIER     = 2.5;  // 최근 7일 평균 일간 증분 대비 배수
const MIN_REVIEW_TOTAL     = 100;  // 전체 누적 리뷰 최소치

async function detectReviewSpike(today) {
  console.log('  [S4] 리뷰 급증 감지 중...');

  // 당일 누적 + 전일 누적 + 최근 7일(전일까지) 평균 일간 증분을 한 번에 계산
  const { rows } = await pool.query(`
    WITH recent AS (
      SELECT
        s.app_id,
        s.snapshot_date,
        s.review_total,
        LAG(s.review_total) OVER (
          PARTITION BY s.app_id ORDER BY s.snapshot_date
        ) AS prev_total
      FROM game_snapshots s
      WHERE s.snapshot_date BETWEEN $1::date - 8 AND $1::date
        AND s.review_total IS NOT NULL
    ),
    increments AS (
      SELECT app_id, snapshot_date, review_total,
             (review_total - prev_total) AS daily_inc
      FROM recent
      WHERE prev_total IS NOT NULL
    )
    SELECT
      g.app_id, g.title,
      cur.review_total,
      cur.daily_inc AS today_inc,
      AVG(hist.daily_inc) FILTER (
        WHERE hist.snapshot_date < $1::date
      ) AS avg7_inc,
      s.review_positive
    FROM increments cur
    JOIN games g ON g.app_id = cur.app_id
    JOIN game_snapshots s ON s.app_id = cur.app_id AND s.snapshot_date = $1
    LEFT JOIN increments hist ON hist.app_id = cur.app_id
    WHERE cur.snapshot_date = $1
      AND g.is_adult_only = FALSE
      AND g.is_dlc = FALSE
      AND cur.review_total >= ${MIN_REVIEW_TOTAL}
    GROUP BY g.app_id, g.title,
             cur.review_total, cur.daily_inc, s.review_positive
  `, [today]);

  let emitted = 0;
  let skipped = 0;

  for (const row of rows) {
    const todayInc = Number(row.today_inc) || 0;
    const avg7Inc  = Number(row.avg7_inc) || 0;

    // 게이트 1: 당일 신규 리뷰가 최소 건수 이상인가
    if (todayInc < MIN_DAILY_INCREMENT) { skipped++; continue; }

    // 게이트 2: 비교할 과거 평균이 없으면 보류 (수집 공백/신규 게임 오탐 방지)
    if (avg7Inc <= 0) { skipped++; continue; }

    // 게이트 3: 평소 대비 가속도 (7일 평균의 N배 이상)
    if (todayInc < avg7Inc * ACCEL_MULTIPLIER) { skipped++; continue; }

    const accelX = (todayInc / avg7Inc).toFixed(1);
    const posPct = row.review_total > 0
      ? ((row.review_positive / row.review_total) * 100).toFixed(1)
      : null;

    const ok = await emitSignal(row.app_id, today, 'review_spike', 'P1', {
      today_inc:  todayInc,
      avg7_inc:   parseFloat(avg7Inc.toFixed(1)),
      accel_x:    parseFloat(accelX),
      pos_pct:    posPct ? parseFloat(posPct) : null
    });
    if (ok) {
      console.log(`    \u2705 review_spike: ${row.title} (\ub2f9\uc77c +${todayInc}, \ud3c9\uc18c ${avg7Inc.toFixed(0)}/\uc77c\uc758 ${accelX}\ubc30, \uae0d\uc815\ub960 ${posPct}%)`);
      emitted++;
    }
  }

  console.log(`  [S4] \uc644\ub8cc: ${emitted}\uac1c \uc2e0\ud638 \uc0dd\uc131 (${skipped}\uac1c \ubcf4\ub958)`);
  return emitted;
}

module.exports = { detectReviewSpike };
