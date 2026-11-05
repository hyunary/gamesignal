const { sleep } = require('./sleep');
require('dotenv').config();

/**
 * 재시도 래퍼 (지수 백오프)
 *
 * 옵션
 *  - maxRetries        : 총 시도 횟수 (기본 RETRY_MAX || 3)
 *  - baseMs            : 일반 에러 백오프 기준 ms (1s → 2s → 4s)
 *  - blockMs           : 429/403 대기 ms (기본 BLOCK_WAIT_MS || 15분)
 *  - skipOnBlock       : true면 429/403 시 대기·재시도 없이 즉시 throw
 *                        (err.isBlocked = true). 게임 단위 수집에서 사용 —
 *                        게임마다 15분씩 기다리다 단계 전체가 timeout 되던 문제 방지
 *  - respectRetryAfter : true면 Retry-After 헤더(초)를 blockMs 상한 내에서 사용
 *  - onFail            : 최종 실패 시 콜백
 */
async function retryWithBackoff(fn, opts = {}) {
  const {
    maxRetries        = parseInt(process.env.RETRY_MAX) || 3,
    baseMs            = parseInt(process.env.RETRY_BASE_MS) || 1000,
    blockMs           = parseInt(process.env.BLOCK_WAIT_MS) || 900000,
    skipOnBlock       = false,
    respectRetryAfter = false,
    label             = '',
    onFail            = null
  } = opts;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status    = err.response?.status;
      const isBlocked = status === 429 || status === 403;
      if (isBlocked) err.isBlocked = true;

      // 차단 응답은 재시도해도 같은 IP라 의미 없음 → 호출자가 건너뛰도록 즉시 전달
      if (isBlocked && skipOnBlock) {
        console.warn(`⚠️  [${label}] HTTP ${status} (차단) → 대기 없이 건너뜀`);
        throw err;
      }

      const isLast = attempt === maxRetries - 1;
      if (isLast) {
        console.error(`❌ [${label}] 최대 재시도(${maxRetries}회) 초과`);
        if (onFail) await onFail(err);
        throw err;
      }

      // 차단(429/403) → blockMs 대기 (Retry-After 우선, 상한 blockMs)
      // 일반 에러      → 지수 백오프
      let waitMs = isBlocked ? blockMs : baseMs * Math.pow(2, attempt);
      if (isBlocked && respectRetryAfter) {
        const ra = parseFloat(err.response?.headers?.['retry-after']);
        if (Number.isFinite(ra) && ra >= 0) waitMs = Math.min(Math.ceil(ra * 1000), blockMs);
      }
      const waitSec = Math.round(waitMs / 1000);
      console.warn(
        `⚠️  [${label}] ${attempt + 1}번째 실패 ` +
        `(${isBlocked ? `IP차단 HTTP ${status}` : `일반에러: ${err.message}`}) ` +
        `→ ${waitSec}초 후 재시도...`
      );
      await sleep(waitMs);
    }
  }
}
module.exports = { retryWithBackoff };
