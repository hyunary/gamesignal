const { sleep } = require('./sleep');
require('dotenv').config();
async function retryWithBackoff(fn, opts = {}) {
  const {
    maxRetries = parseInt(process.env.RETRY_MAX) || 3,
    baseMs     = parseInt(process.env.RETRY_BASE_MS) || 1000,
    blockMs    = parseInt(process.env.BLOCK_WAIT_MS) || 900000,
    label      = '',
    onFail     = null
  } = opts;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status    = err.response?.status;
      const isBlocked = status === 429 || status === 403;
      const isLast    = attempt === maxRetries - 1;
      if (isLast) {
        console.error(`❌ [${label}] 최대 재시도(${maxRetries}회) 초과`);
        if (onFail) await onFail(err);
        throw err;
      }
      // IP 차단(429/403) → 15분 대기
      // 일반 에러 → 지수 백오프 (1s → 2s → 4s)
      const waitMs = isBlocked ? blockMs : baseMs * Math.pow(2, attempt);
      const waitSec = Math.round(waitMs / 1000);
      console.warn(
        `⚠️  [${label}] ${attempt + 1}번째 실패 ` +
        `(${isBlocked ? 'IP차단' : '일반에러'}) ` +
        `→ ${waitSec}초 후 재시도...`
      );
      await sleep(waitMs);
    }
  }
}
module.exports = { retryWithBackoff };
