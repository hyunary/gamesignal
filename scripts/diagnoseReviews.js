#!/usr/bin/env node
/**
 * Steam 리뷰 API 응답 진단 (DB·secrets 불필요)
 *
 *   node scripts/diagnoseReviews.js 730 4019220 4080220
 *
 * 수집기(src/collectors/reviews.js)와 동일한 URL·판정 함수로
 * IUserReviewsService/GetAppReviews를 호출해 다음을 출력한다:
 *   HTTP 상태 / Content-Type / 판정(OK 또는 사유 코드) / total·positive·negative / 본문 앞 300자
 * 730(CS2)은 구 API 마지막 값(10/22 DB 993만)과 이어지는지 확인하기 위해
 * total_reviews가 990만대(9,900,000 이상)인지 함께 표시한다.
 */
const axios = require('axios');
const { classifyReviewResponse, buildReviewsUrl } = require('../src/collectors/reviews');

const CS2_APPID = 730;
const CS2_MIN_EXPECTED = 9_900_000; // 10/22 구 API 값 993만 → 이후 증가만 가능

const man = (n) => `${(n / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;

async function probe(appId) {
  const url = buildReviewsUrl(appId);
  try {
    const res = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    return { url, status: res.status, type: res.headers['content-type'] || '-', body: res.data, verdict: classifyReviewResponse(appId, res.status, res.data) };
  } catch (e) {
    return { url, status: null, type: '-', body: '', verdict: { ok: false, reason: `NETWORK_${e.code || 'ERROR'}`, head: e.message } };
  }
}

(async () => {
  const ids = process.argv.slice(2).map(Number).filter(Number.isInteger);
  if (ids.length === 0) {
    console.error('사용법: node scripts/diagnoseReviews.js <appid> [appid...]   (예: 730)');
    process.exit(2);
  }
  let anyFail = false;
  for (const [i, id] of ids.entries()) {
    if (i > 0) await new Promise((ok) => setTimeout(ok, 1600)); // 수집기와 같은 호출 간격
    const r = await probe(id);
    console.log(`\n══════ appid ${id} ══════`);
    console.log(`URL   : ${r.url}`);
    console.log(`HTTP  : ${r.status ?? '-'} | ${r.type}`);
    if (r.verdict.ok) {
      const v = r.verdict.reviews;
      console.log(`판정  : OK`);
      console.log(`리뷰  : total_reviews=${v.reviewTotal.toLocaleString()} (${man(v.reviewTotal)}) · positive=${v.reviewPositive.toLocaleString()} · negative=${v.reviewNegative.toLocaleString()}`);
      if (id === CS2_APPID) {
        const ok = v.reviewTotal >= CS2_MIN_EXPECTED;
        if (!ok) anyFail = true;
        console.log(`검증  : ${ok ? '✅' : '⚠️'} CS2 total_reviews ${man(v.reviewTotal)} — 기대값 990만대 이상(10/22 DB 993만과 연속) ${ok ? '충족' : '미달 (languages/purchase_type 확인 필요)'}`);
      }
    } else {
      anyFail = true;
      console.log(`판정  : ${r.verdict.reason}`);
    }
    console.log(`본문  : ${String(r.body || r.verdict.head || '').slice(0, 300).replace(/\s+/g, ' ')}`);
  }
  process.exit(anyFail ? 1 : 0);
})();
