const axios = require('axios');
const pool = require('../db/pool');
const { withPipelineRun, deriveStatus } = require('../utils/pipelineRun');
const { sleep } = require('../utils/sleep');
require('dotenv').config();

// ── 설정 (환경변수로 조정 가능) ──────────────────────────────────────
// 단계 전체 시간 상한. 초과 시 남은 게임은 건너뛰고 partial로 마감 → 신호 엔진이 반드시 실행되도록
const BUDGET_MS            = parseInt(process.env.REVIEWS_BUDGET_MS) || 15 * 60 * 1000;
// 호출 간격. 키 없는 Web API 호출은 한도가 낮으므로 1.6초(5분 약 187회) 유지
const INTERVAL_MS          = parseInt(process.env.REVIEWS_INTERVAL_MS) || 1600;
// 연속 차단(429/403)이 이 횟수에 도달하면 IP 차단으로 보고 남은 게임 수집 중단
const MAX_CONSECUTIVE_BLOCKS = parseInt(process.env.REVIEWS_MAX_CONSECUTIVE_BLOCKS) || 5;
// 일시 오류(네트워크/5xx) 재시도 횟수 — 차단은 재시도하지 않음
const MAX_ATTEMPTS         = 2;
const RETRY_BACKOFF_MS     = 2000;
const REQUEST_TIMEOUT_MS   = 10000;

// Steam이 2026-10-22에 store.steampowered.com/appreviews를 폐지
// (이후 HTTP 200 + 상점 홈 HTML 반환 → 10/23부터 리뷰 0건) → 공식 Web API로 이전. 키 불필요
const REVIEWS_ENDPOINT = 'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/';

/**
 * GetAppReviews 요청 입력
 *  - languages ["all"] : 생략하면 영어 리뷰만 집계됨 (CS2 기준 153만 vs 534만)
 *  - purchase_type 1   : 전체 (0=Steam 구매, 2=외부 구매). 구 API 'all'과 같은 기준 (CS2 996만 ≈ 10/22 DB 993만)
 *  - num_per_page 1    : 0은 20으로 취급된다는 보고가 있어 1 사용 (집계값만 필요)
 */
function reviewsInput(appId) {
  return { appid: Number(appId), num_per_page: 1, languages: ['all'], purchase_type: 1 };
}

// input_json은 JSON.stringify 후 encodeURIComponent로 직접 인코딩
// (axios params 직렬화는 : , [ ] 를 인코딩하지 않으므로 사용하지 않음)
function buildReviewsUrl(appId) {
  return `${REVIEWS_ENDPOINT}?input_json=${encodeURIComponent(JSON.stringify(reviewsInput(appId)))}`;
}

/**
 * GetAppReviews 응답 판정 (순수 함수 — 테스트 대상)
 * 응답: { response: { query_summary: { total_reviews, total_positive, total_negative, ... }, reviews: [...], cursor } }
 * success 필드가 없으므로 HTTP 상태와 response.query_summary로 판정한다.
 *   BLOCKED    : 429/403 — 건너뜀, 재시도 안 함
 *   HTTP_5xx   : 서버 오류 — 재시도
 *   HTTP_xxx   : 그 외 비정상 상태 — 재시도 안 함
 *   NON_JSON   : HTML 등 JSON이 아닌 응답 (구 appreviews가 상점 홈 HTML을 돌려주던 경우 포함)
 *   NO_SUMMARY : response.query_summary 없음, 또는 total_reviews가 숫자가 아님 (형식 변경 의심)
 * total_positive/negative가 빠져 있으면 0으로 본다 (protobuf JSON은 0인 필드를 생략할 수 있음).
 * query_summary에 집계 필드가 하나도 없고 reviews도 비어 있으면 리뷰 0건 게임으로 보고 0으로 처리.
 */
function classifyReviewResponse(appId, status, rawBody) {
  const head = typeof rawBody === 'string' ? rawBody.slice(0, 300) : JSON.stringify(rawBody ?? null).slice(0, 300);
  if (status === 429 || status === 403) return { ok: false, reason: 'BLOCKED', retryable: false, status, head };
  if (status >= 500) return { ok: false, reason: `HTTP_${status}`, retryable: true, status, head };
  if (status !== 200) return { ok: false, reason: `HTTP_${status}`, retryable: false, status, head };

  let data = rawBody;
  if (typeof rawBody === 'string') {
    try { data = JSON.parse(rawBody); }
    catch { return { ok: false, reason: 'NON_JSON', retryable: false, status, head }; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, reason: 'NON_JSON', retryable: false, status, head };
  }

  const resp = data.response;
  const s = resp && typeof resp === 'object' ? resp.query_summary : null;
  if (!s || typeof s !== 'object') return { ok: false, reason: 'NO_SUMMARY', retryable: false, status, head };

  const hasCounts = ['total_reviews', 'total_positive', 'total_negative'].some((k) => k in s);
  const noReviews = !hasCounts && (!Array.isArray(resp.reviews) || resp.reviews.length === 0);
  if (!noReviews && typeof s.total_reviews !== 'number') {
    return { ok: false, reason: 'NO_SUMMARY', retryable: false, status, head };
  }
  return {
    ok: true,
    reviews: {
      appId,
      reviewTotal:    noReviews ? 0 : s.total_reviews,
      reviewPositive: Number.isFinite(s.total_positive) ? s.total_positive : 0,
      reviewNegative: Number.isFinite(s.total_negative) ? s.total_negative : 0,
    },
  };
}

// 판정 결과를 Error로 변환 (reason/retryable/head 보존)
function reviewError(appId, verdict) {
  const err = new Error(`리뷰 수집 실패(${verdict.reason}) appId=${appId} HTTP ${verdict.status ?? '-'}`);
  Object.assign(err, verdict, { appId });
  return err;
}

/**
 * Steam 리뷰 1건 조회 (전체 누적 집계만) — IUserReviewsService/GetAppReviews
 * 리뷰 급증은 signal4.js가 매일의 review_total 차분으로 계산한다.
 * 상태 코드와 본문을 직접 판정하기 위해 axios의 자동 throw/JSON 파싱을 끈다.
 */
async function fetchReviews(appId) {
  let res;
  try {
    res = await axios.get(buildReviewsUrl(appId), {
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(d) => d],
    });
  } catch (e) {
    // 응답 자체가 없는 경우 (timeout, DNS, 연결 끊김) → 재시도 대상
    throw reviewError(appId, { reason: `NETWORK_${e.code || 'ERROR'}`, retryable: true, status: null, head: e.message });
  }
  const verdict = classifyReviewResponse(appId, res.status, res.data);
  if (!verdict.ok) throw reviewError(appId, verdict);
  return verdict.reviews;
}

// 일시 오류만 재시도, 차단·형식 오류는 즉시 throw
async function fetchWithRetry(appId, { fetch = fetchReviews, wait = sleep } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(appId);
    } catch (err) {
      if (!err.retryable || attempt >= MAX_ATTEMPTS) throw err;
      await wait(RETRY_BACKOFF_MS * attempt);
    }
  }
}

/**
 * 수집 루프 본체 (DB·네트워크·시계 주입 가능 — 테스트 대상)
 * 반환: { saved, failed, skipped, blocked, aborted, reasons }
 *   aborted: null | 'BUDGET' | 'BLOCKED'
 *   reasons: { [reason]: { count, sample: { appId, status, head } } }
 */
async function collectReviewsCore(targets, deps = {}) {
  const {
    fetch = (id) => fetchWithRetry(id),
    save,
    now = Date.now,
    wait = sleep,
    budgetMs = BUDGET_MS,
    intervalMs = INTERVAL_MS,
    maxConsecutiveBlocks = MAX_CONSECUTIVE_BLOCKS,
    log = console,
  } = deps;

  const deadline = now() + budgetMs;
  const stats = { saved: 0, failed: 0, skipped: 0, blocked: 0, aborted: null, reasons: {} };
  let consecutiveBlocks = 0;

  for (let i = 0; i < targets.length; i++) {
    const game = targets[i];
    if (now() >= deadline) {
      stats.aborted = 'BUDGET';
      stats.skipped += targets.length - i;
      log.warn(`  ⏱️ 리뷰 단계 시간 상한(${Math.round(budgetMs / 60000)}분) 도달 → 남은 ${targets.length - i}개 건너뜀`);
      break;
    }
    if (i > 0) await wait(intervalMs);

    try {
      const reviews = await fetch(game.app_id);
      await save(game, reviews);
      consecutiveBlocks = 0;
      stats.saved++;
      log.log(
        `  ✅ ${game.title}: 총 ${reviews.reviewTotal.toLocaleString()}개 ` +
        `(긍정 ${reviews.reviewPositive.toLocaleString()})`
      );
    } catch (err) {
      const reason = err.reason || 'UNKNOWN';
      const bucket = stats.reasons[reason] || (stats.reasons[reason] = { count: 0, sample: null });
      bucket.count++;
      if (!bucket.sample) bucket.sample = { appId: game.app_id, status: err.status ?? null, head: err.head ?? err.message };

      if (reason === 'BLOCKED') {
        stats.blocked++;
        stats.skipped++;
        consecutiveBlocks++;
        log.warn(`  ⛔ 차단(HTTP ${err.status}) → ${game.title} 건너뜀 (연속 ${consecutiveBlocks}회)`);
        if (consecutiveBlocks >= maxConsecutiveBlocks) {
          stats.aborted = 'BLOCKED';
          stats.skipped += targets.length - i - 1;
          log.warn(`  ⛔ 연속 차단 ${consecutiveBlocks}회 → IP 차단으로 판단, 남은 ${targets.length - i - 1}개 건너뜀`);
          break;
        }
      } else {
        consecutiveBlocks = 0;
        stats.failed++;
        log.warn(`  ⚠️ 실패 (${game.title}): ${err.message}`);
      }
    }
  }
  return stats;
}

// pipeline_runs.error_message용 요약 문자열
function summarizeReasons(stats, total) {
  const parts = Object.entries(stats.reasons)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([r, v]) => `${r}×${v.count}`);
  let msg = `${stats.saved}/${total} 저장`;
  if (parts.length) msg += ` · 실패 사유: ${parts.join(', ')}`;
  if (stats.aborted) msg += ` · 중단: ${stats.aborted}`;
  return msg;
}

// 스냅샷 업데이트 (전체 누적만 저장 — 급증 판정은 signal4.js)
async function saveReviews(today, game, reviews) {
  await pool.query(`
    INSERT INTO game_snapshots
      (app_id, snapshot_date, review_total, review_positive, review_negative)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (app_id, snapshot_date) DO UPDATE SET
      review_total    = EXCLUDED.review_total,
      review_positive = EXCLUDED.review_positive,
      review_negative = EXCLUDED.review_negative,
      collected_at    = NOW()
  `, [game.app_id, today, reviews.reviewTotal, reviews.reviewPositive, reviews.reviewNegative]);
}

async function collectReviews() {
  console.log('📝 Steam 리뷰 수집 시작...');
  console.log(`   (시간 상한 ${Math.round(BUDGET_MS / 60000)}분 · 호출 간격 ${INTERVAL_MS}ms · 연속 차단 ${MAX_CONSECUTIVE_BLOCKS}회 시 중단)`);

  // KST 기준 오늘 날짜 (UTC+9)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().split('T')[0];

  let result = null;
  await withPipelineRun('reviews', async (run) => {
    // 오늘 수집된 게임 대상 (Most Played + Wishlist 합집합)
    const { rows: targets } = await pool.query(`
      SELECT DISTINCT g.app_id, g.title
      FROM games g
      JOIN game_snapshots s ON s.app_id = g.app_id
      WHERE s.snapshot_date = $1
        AND g.is_adult_only = FALSE
        AND g.is_dlc = FALSE
        AND g.is_software = FALSE
      ORDER BY g.app_id
    `, [today]);
    console.log(`📋 수집 대상: ${targets.length}개 게임`);

    const stats = await collectReviewsCore(targets, {
      save: (game, reviews) => saveReviews(today, game, reviews),
    });

    run.expected  = targets.length;
    run.collected = stats.saved;
    run.failed    = stats.failed + stats.blocked;
    run.skipped   = stats.skipped;
    run.status    = deriveStatus({ ...run });   // 0건이면 failed (전부 실패해도 success로 남던 문제)
    run.error     = (run.status === 'success') ? null : summarizeReasons(stats, targets.length);

    // 사유별 첫 사례 — 응답 형식 변경/파라미터 문제 판단 근거 (HTTP 상태 + 본문 앞 300자)
    if (Object.keys(stats.reasons).length) {
      console.log('\n🔎 실패 사유별 첫 사례:');
      for (const [reason, v] of Object.entries(stats.reasons)) {
        console.log(`  - ${reason} ×${v.count} | appId=${v.sample.appId} HTTP ${v.sample.status ?? '-'} | ${String(v.sample.head).replace(/\s+/g, ' ')}`);
      }
    }
    console.log(`\n📊 결과: ${summarizeReasons(stats, targets.length)} → ${run.status}`);
    result = { ...stats, total: targets.length, status: run.status };
  });
  return result;
}

module.exports = {
  collectReviews, collectReviewsCore, fetchReviews, fetchWithRetry,
  classifyReviewResponse, summarizeReasons, buildReviewsUrl, reviewsInput,
};

// 직접 실행 시 — failed면 exit 1 (run.js가 실패로 인식)
if (require.main === module) {
  collectReviews()
    .then(async (r) => {
      await pool.end().catch(() => {});
      if (r?.status === 'failed') {
        console.error('\n❌ 리뷰 수집 실패 (저장 0건)');
        process.exit(1);
      }
      console.log('\n🎉 리뷰 수집 완료!');
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ 실패:', err.message);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}
