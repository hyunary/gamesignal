/**
 * 신호 표기 문구 (순수 함수) — 로그와 Discord가 같은 문구를 쓰도록 공용화
 */
const { shortDate } = require('../db/wishlistBaseline');

const isRank = (v) => Number.isInteger(v) && v > 0;

/**
 * 위시리스트 급등 표기: "31위→8위, +23계단 (기준 11/10)"
 * - baseline_date가 없으면(이전 버전 신호) 기준 표기 생략
 * - prev_rank가 없으면 "null" 대신 "8위 (이전 순위 확인 불가)"
 */
function surgeLabel({ prev_rank, curr_rank, change, baseline_date } = {}) {
  const base = baseline_date ? ` (기준 ${shortDate(baseline_date)})` : '';
  if (!isRank(prev_rank)) return `${isRank(curr_rank) ? `${curr_rank}위` : '순위 미상'} (이전 순위 확인 불가)${base}`;
  const delta = Number.isInteger(change) ? change : prev_rank - curr_rank;
  return `${prev_rank}위→${curr_rank}위, +${delta}계단${base}`;
}

module.exports = { surgeLabel };
