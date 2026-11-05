#!/usr/bin/env node
/**
 * Steam appreviews 응답 진단 (DB·secrets 불필요)
 *
 *   node scripts/diagnoseReviews.js 4019220 4080220 4115450 730
 *
 * 같은 appid를 파라미터 조합별로 호출해 HTTP 상태 / Content-Type / 최종 URL /
 * 본문 앞 300자 / 수집기 판정(classifyReviewResponse)을 출력한다.
 *  - 현재 파라미터만 실패하고 최소 파라미터는 성공 → 파라미터 문제
 *  - 모든 조합이 200인데 NON_JSON/NO_SUMMARY → 응답 형식 변경
 *  - success=1 이고 total_reviews=0 → 신작이라 리뷰 없음 (정상 처리됨)
 *  - 429/403 → 차단
 * 마지막 대조군으로 730(CS2)처럼 리뷰가 많은 게임을 함께 넣을 것.
 */
const axios = require('axios');
const { classifyReviewResponse } = require('../src/collectors/reviews');

const VARIANTS = [
  { name: '현재 수집기 파라미터', params: { json: 1, purchase_type: 'all', language: 'all', num_per_page: 0 } },
  { name: '최소 파라미터',        params: { json: 1 } },
  { name: '공식 문서 기본값',     params: { json: 1, filter: 'all', language: 'all', purchase_type: 'all', num_per_page: 20 } },
];

async function probe(appId, variant) {
  try {
    const res = await axios.get(`https://store.steampowered.com/appreviews/${appId}`, {
      params: variant.params,
      timeout: 15000,
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(d) => d],
      maxRedirects: 5,
    });
    const verdict = classifyReviewResponse(appId, res.status, res.data);
    let summary = '';
    try {
      const j = JSON.parse(res.data);
      summary = ` success=${j.success} total_reviews=${j.query_summary?.total_reviews} review_score_desc=${JSON.stringify(j.query_summary?.review_score_desc)}`;
    } catch { /* JSON 아님 */ }
    return {
      line: `HTTP ${res.status} | ${res.headers['content-type'] || '-'} | ${res.request?.res?.responseUrl || '-'}`,
      verdict: verdict.ok ? 'OK' : verdict.reason,
      summary,
      head: String(res.data).slice(0, 300).replace(/\s+/g, ' '),
    };
  } catch (e) {
    return { line: `요청 실패: ${e.code || ''} ${e.message}`, verdict: 'NETWORK', summary: '', head: '' };
  }
}

(async () => {
  const ids = process.argv.slice(2).map(Number).filter(Number.isInteger);
  if (ids.length === 0) {
    console.error('사용법: node scripts/diagnoseReviews.js <appid> [appid...]');
    process.exit(2);
  }
  for (const id of ids) {
    console.log(`\n══════ appid ${id} ══════`);
    for (const v of VARIANTS) {
      const r = await probe(id, v);
      console.log(`[${v.name}] → 판정 ${r.verdict}${r.summary}`);
      console.log(`   ${r.line}`);
      console.log(`   본문: ${r.head}`);
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
})();
