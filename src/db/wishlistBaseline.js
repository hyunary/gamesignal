/**
 * 위시리스트 기준일 — wishlist 수집기(목록 급변 검사·순위 비교)와
 * S3(위시리스트 급등)가 같은 기준을 쓰도록 한 곳에서 정의한다.
 *
 * 기준일: 오늘 이전 LOOKBACK_DAYS(7)일 안에서 위시리스트 행이 MIN_ROWS(40) 이상인 가장 최근 날
 *  - 저장 0건이었던 날(예: 11/12)은 건너뜀
 *  - 기준일이 오늘-1이 아니면 gapDays ≥ 2 (예: 11/13 기준 11/10 → 3)
 */
const pool = require('./pool');

const BASELINE_MIN_ROWS = parseInt(process.env.WISHLIST_BASELINE_MIN_ROWS) || 40;
const BASELINE_LOOKBACK_DAYS = 7;

// 'YYYY-MM-DD' 두 날짜 사이 일수 (to - from), 시간대 영향 없이 UTC 자정 기준
function daysBetween(fromDate, toDate) {
  const ms = Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`);
  return Math.round(ms / 86400000);
}

// '2026-11-10' → '11/10'
function shortDate(date) {
  const [, m, d] = String(date).split('-');
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 기준일 조회
 * 반환: { date: 'YYYY-MM-DD', ids: number[], gapDays } | null (7일 안에 기준일 없음)
 */
async function loadWishlistBaseline(today, db = pool) {
  const { rows } = await db.query(`
    SELECT snapshot_date::text AS date, array_agg(app_id) AS ids
    FROM game_snapshots
    WHERE snapshot_date <  $1::date
      AND snapshot_date >= $1::date - $2::int
      AND wishlist_rank IS NOT NULL
    GROUP BY snapshot_date
    HAVING COUNT(*) >= $3
    ORDER BY snapshot_date DESC
    LIMIT 1
  `, [today, BASELINE_LOOKBACK_DAYS, BASELINE_MIN_ROWS]);
  const row = rows[0];
  if (!row) return null;
  return { date: row.date, ids: (row.ids || []).map(Number), gapDays: daysBetween(row.date, today) };
}

module.exports = {
  loadWishlistBaseline, daysBetween, shortDate,
  BASELINE_MIN_ROWS, BASELINE_LOOKBACK_DAYS,
};
