// 파이프라인 복원력 단위 테스트 — DB·네트워크 불필요 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  classifyReviewResponse, collectReviewsCore, fetchWithRetry, summarizeReasons, buildReviewsUrl,
} = require('../../src/collectors/reviews');
const { withPipelineRun, deriveStatus } = require('../../src/utils/pipelineRun');
const { retryWithBackoff } = require('../../src/utils/retry');
const { runStep } = require('../../pipeline/run');

const quietLog = { log() {}, warn() {}, error() {} };
const noWait = async () => {};

// ── 리뷰 응답 판정 — IUserReviewsService/GetAppReviews 신규 구조 ─────
// 토마스가 Mac Mini에서 CS2(730) 호출로 확인한 응답 구조 기반 샘플
const GETAPPREVIEWS_SAMPLE = JSON.stringify({
  response: {
    query_summary: {
      num_reviews: 1, review_score: 8, review_score_desc: 'Very Positive',
      total_positive: 8620000, total_negative: 1340000, total_reviews: 9960000,
    },
    reviews: [{ recommendationid: '1', author: { steamid: '1' }, language: 'english', voted_up: true }],
    cursor: 'AoJ4abc=',
  },
});
// 2026-10-22 이후 구 appreviews가 돌려주는 상점 홈 HTML (HTTP 200)
const STORE_HOME_HTML =
  '<!DOCTYPE html>\n<html class=" responsive" lang="en">\n<head>\n\t<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n' +
  '\t<title>Welcome to Steam</title>\n' + '\t<link href="https://store.cloudflare.steamstatic.com/public/shared/css/motiva_sans.css" rel="stylesheet">\n'.repeat(10);

test('classify: GetAppReviews 신규 응답 샘플 → ok, total/positive/negative 추출', () => {
  const v = classifyReviewResponse(730, 200, GETAPPREVIEWS_SAMPLE);
  assert.equal(v.ok, true);
  assert.deepEqual(v.reviews, { appId: 730, reviewTotal: 9960000, reviewPositive: 8620000, reviewNegative: 1340000 });
});
test('classify: 상점 홈 HTML(HTTP 200) → NON_JSON + 본문 앞 300자 보존', () => {
  const v = classifyReviewResponse(730, 200, STORE_HOME_HTML);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'NON_JSON');
  assert.equal(v.head.length, 300);
  assert.match(v.head, /Welcome to Steam/);
});
test('classify: 구 appreviews 구조(최상위 success/query_summary)는 더 이상 인정 안 함 → NO_SUMMARY', () => {
  const old = '{"success":1,"query_summary":{"total_reviews":120,"total_positive":100,"total_negative":20}}';
  assert.equal(classifyReviewResponse(1, 200, old).reason, 'NO_SUMMARY');
});
test('classify: response 또는 query_summary 없음 → NO_SUMMARY', () => {
  assert.equal(classifyReviewResponse(1, 200, '{}').reason, 'NO_SUMMARY');
  assert.equal(classifyReviewResponse(1, 200, '{"response":{}}').reason, 'NO_SUMMARY');
  assert.equal(classifyReviewResponse(1, 200, '{"response":{"query_summary":"x"}}').reason, 'NO_SUMMARY');
});
test('classify: 리뷰가 있는데 total_reviews가 숫자가 아님 → NO_SUMMARY (형식 변경 의심)', () => {
  const body = JSON.stringify({ response: { query_summary: { total_positive: 5 }, reviews: [{}] } });
  assert.equal(classifyReviewResponse(1, 200, body).reason, 'NO_SUMMARY');
});
test('classify: 0인 필드 생략(protobuf JSON) → 0으로 처리', () => {
  // 전부 긍정이라 total_negative 생략
  const allPositive = JSON.stringify({ response: { query_summary: { total_reviews: 40, total_positive: 40 }, reviews: [{}] } });
  assert.deepEqual(classifyReviewResponse(2, 200, allPositive).reviews, { appId: 2, reviewTotal: 40, reviewPositive: 40, reviewNegative: 0 });
  // 리뷰 0건 신작: 집계 필드가 모두 생략되고 reviews도 비어 있음
  const empty = JSON.stringify({ response: { query_summary: { review_score_desc: 'No user reviews' }, reviews: [] } });
  assert.deepEqual(classifyReviewResponse(3, 200, empty).reviews, { appId: 3, reviewTotal: 0, reviewPositive: 0, reviewNegative: 0 });
  // total_reviews: 0 명시
  const zero = JSON.stringify({ response: { query_summary: { total_reviews: 0 } } });
  assert.equal(classifyReviewResponse(4, 200, zero).reviews.reviewTotal, 0);
});
test('classify: 429/403 → BLOCKED(재시도 안 함), 5xx → 재시도, 404 → HTTP_404', () => {
  for (const st of [429, 403]) {
    const v = classifyReviewResponse(3, st, 'Too Many Requests');
    assert.equal(v.reason, 'BLOCKED'); assert.equal(v.retryable, false);
  }
  assert.equal(classifyReviewResponse(4, 502, '').retryable, true);
  const v = classifyReviewResponse(4, 404, '');
  assert.equal(v.reason, 'HTTP_404'); assert.equal(v.retryable, false);
});
test('buildReviewsUrl: 신규 엔드포인트 + input_json(JSON.stringify → URL 인코딩)', () => {
  const url = buildReviewsUrl(730);
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, 'https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/');
  assert.deepEqual(JSON.parse(u.searchParams.get('input_json')), { appid: 730, num_per_page: 1, languages: ['all'], purchase_type: 1 });
  assert.doesNotMatch(url.split('?')[1], /[{}"\[\]:,]/, '구분 문자가 모두 인코딩돼야 함');
  assert.deepEqual([...u.searchParams.keys()], ['input_json'], 'key 파라미터 없이 호출');
});

// ── 리뷰 수집 루프: 시간 상한 · 차단 건너뛰기 · 0건 failed ────────────
const games = (n) => Array.from({ length: n }, (_, i) => ({ app_id: 1000 + i, title: `G${i}` }));
const okReviews = (id) => ({ appId: id, reviewTotal: 10, reviewPositive: 8, reviewNegative: 2 });
const blockedErr = () => Object.assign(new Error('blocked'), { reason: 'BLOCKED', status: 429, head: 'Too Many' });

test('core: 시간 상한 도달 시 남은 게임 건너뛰고 BUDGET 중단', async () => {
  let t = 0;
  const stats = await collectReviewsCore(games(10), {
    fetch: async (id) => { t += 100; return okReviews(id); }, // 게임당 100ms 소요
    save: async () => {},
    now: () => t, wait: noWait, budgetMs: 350, intervalMs: 0, log: quietLog,
  });
  assert.equal(stats.aborted, 'BUDGET');
  assert.equal(stats.saved, 4);
  assert.equal(stats.skipped, 6);
});

test('core: 429는 대기 없이 해당 게임만 건너뜀, 성공 시 연속 카운터 리셋', async () => {
  const blockedIds = new Set([1000, 1002]);
  const stats = await collectReviewsCore(games(4), {
    fetch: async (id) => { if (blockedIds.has(id)) throw blockedErr(); return okReviews(id); },
    save: async () => {}, wait: noWait, intervalMs: 0, maxConsecutiveBlocks: 2, log: quietLog,
  });
  assert.equal(stats.aborted, null);
  assert.equal(stats.saved, 2);
  assert.equal(stats.blocked, 2);
});

test('core: 연속 차단 N회면 IP 차단으로 판단해 중단', async () => {
  const stats = await collectReviewsCore(games(10), {
    fetch: async () => { throw blockedErr(); },
    save: async () => {}, wait: noWait, intervalMs: 0, maxConsecutiveBlocks: 3, log: quietLog,
  });
  assert.equal(stats.aborted, 'BLOCKED');
  assert.equal(stats.blocked, 3);
  assert.equal(stats.skipped, 10); // 차단 3 + 남은 7
});

test('core: 사유별 집계와 첫 사례 보존 (10번 진단 근거)', async () => {
  const stats = await collectReviewsCore(games(3), {
    fetch: async (id) => { throw Object.assign(new Error('x'), { reason: 'NO_SUMMARY', status: 200, head: `{"response":{}} ${id}` }); },
    save: async () => {}, wait: noWait, intervalMs: 0, log: quietLog,
  });
  assert.equal(stats.saved, 0);
  assert.equal(stats.reasons.NO_SUMMARY.count, 3);
  assert.equal(stats.reasons.NO_SUMMARY.sample.appId, 1000);
  assert.match(summarizeReasons(stats, 3), /0\/3 저장 · 실패 사유: NO_SUMMARY×3/);
});

test('fetchWithRetry: 일시 오류만 1회 재시도, 형식 오류는 즉시 실패', async () => {
  let calls = 0;
  const flaky = async (id) => { calls++; if (calls === 1) throw Object.assign(new Error('t'), { retryable: true }); return okReviews(id); };
  assert.equal((await fetchWithRetry(1, { fetch: flaky, wait: noWait })).appId, 1);
  assert.equal(calls, 2);
  calls = 0;
  const bad = async () => { calls++; throw Object.assign(new Error('f'), { retryable: false }); };
  await assert.rejects(fetchWithRetry(1, { fetch: bad, wait: noWait }));
  assert.equal(calls, 1);
});

// ── 11. 상태 판정: 0건이면 failed ────────────────────────────────────
test('deriveStatus: 0건 → failed, 일부 실패 → partial, 대상 없음 → success', () => {
  assert.equal(deriveStatus({ collected: 0, failed: 150, expected: 150 }), 'failed');
  assert.equal(deriveStatus({ collected: 0, expected: 0 }), 'success');
  assert.equal(deriveStatus({ collected: 40, failed: 3, expected: 43 }), 'partial');
  assert.equal(deriveStatus({ collected: 40, skipped: 10, expected: 50 }), 'partial');
  assert.equal(deriveStatus({ collected: 50, expected: 50 }), 'success');
});

// ── try/finally: 예외에도 'running'으로 남지 않음 ────────────────────
function fakeRuns() {
  const calls = [];
  return {
    calls,
    deps: {
      startPipelineRun: async (src) => { calls.push(['start', src]); return 'run-1'; },
      finishPipelineRun: async (...a) => { calls.push(['finish', ...a]); },
    },
  };
}
test('withPipelineRun: 본문 throw → failed + 오류 메시지로 마감 후 rethrow', async () => {
  const f = fakeRuns();
  await assert.rejects(withPipelineRun('reviews', async (run) => { run.collected = 3; throw new Error('DB 끊김'); }, f.deps), /DB 끊김/);
  assert.deepEqual(f.calls[1], ['finish', 'run-1', 'failed', 3, 'DB 끊김', 0]);
});
test('withPipelineRun: 정상 → 수집 결과로 상태 결정', async () => {
  const f = fakeRuns();
  await withPipelineRun('wishlist', async (run) => { run.collected = 50; run.expected = 50; }, f.deps);
  assert.equal(f.calls[1][2], 'success');
});
test('withPipelineRun: 마감 기록 실패가 원래 결과를 가리지 않음', async () => {
  const deps = { startPipelineRun: async () => 'r', finishPipelineRun: async () => { throw new Error('기록 실패'); } };
  const origErr = console.error; console.error = () => {};
  try {
    assert.equal(await withPipelineRun('x', async (run) => { run.collected = 1; return 'ok'; }, deps), 'ok');
  } finally { console.error = origErr; }
});

// ── retry: 차단 시 15분 대기하지 않음 ────────────────────────────────
const httpErr = (status, headers = {}) => Object.assign(new Error(`HTTP ${status}`), { response: { status, headers } });
test('retry skipOnBlock: 429면 대기 없이 즉시 throw (isBlocked)', async () => {
  let calls = 0;
  const t0 = Date.now();
  const origWarn = console.warn; console.warn = () => {};
  try {
    await assert.rejects(retryWithBackoff(async () => { calls++; throw httpErr(429); },
      { maxRetries: 3, blockMs: 60000, skipOnBlock: true, label: 't' }), (e) => e.isBlocked === true);
  } finally { console.warn = origWarn; }
  assert.equal(calls, 1);
  assert.ok(Date.now() - t0 < 1000);
});
test('retry respectRetryAfter: Retry-After(초)를 blockMs 상한 내에서 사용', async () => {
  let calls = 0;
  const t0 = Date.now();
  const origWarn = console.warn; console.warn = () => {};
  try {
    const r = await retryWithBackoff(async () => { calls++; if (calls === 1) throw httpErr(429, { 'retry-after': '0.05' }); return 'ok'; },
      { maxRetries: 2, blockMs: 60000, respectRetryAfter: true, label: 't' });
    assert.equal(r, 'ok');
  } finally { console.warn = origWarn; }
  assert.ok(Date.now() - t0 < 2000, '60초 blockMs가 아니라 Retry-After 50ms만 대기해야 함');
});

// ── run.js: 단계 timeout이 실제로 자식 프로세스를 끊고 다음으로 진행 ───
function tmpScript(code) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-step-'));
  const p = path.join(dir, 's.js');
  fs.writeFileSync(p, code);
  return p;
}
function stepDeps() {
  const stale = []; const alerts = [];
  return {
    stale, alerts,
    deps: {
      today: '2026-11-05',
      failStaleRuns: async (d, s, m) => { stale.push([d, s, m]); return 1; },
      alert: async (l, m) => { alerts.push([l, m]); },
    },
  };
}
test('runStep: 상한 초과 시 강제 종료 → timeout + running 행 마감 + 알림', async () => {
  const d = stepDeps();
  const origErr = console.error; const origLog = console.log; console.error = () => {}; console.log = () => {};
  const t0 = Date.now();
  let r;
  try {
    r = await runStep({ label: '3/5 리뷰', script: tmpScript('setTimeout(() => {}, 60000);'), source: 'reviews', timeoutMs: 500 }, d.deps);
  } finally { console.error = origErr; console.log = origLog; }
  assert.equal(r.outcome, 'timeout');
  assert.ok(Date.now() - t0 < 10000);
  assert.deepEqual(d.stale[0].slice(0, 2), ['2026-11-05', ['reviews']]);
  assert.equal(d.alerts.length, 1);
});
test('runStep: exit 1 → failed, exit 0 → ok (마감·알림 없음)', async () => {
  const d = stepDeps();
  const origErr = console.error; const origLog = console.log; console.error = () => {}; console.log = () => {};
  try {
    const f = await runStep({ label: 'x', script: tmpScript('process.exit(1)'), source: 'wishlist', timeoutMs: 5000 }, d.deps);
    assert.equal(f.outcome, 'failed');
    const ok = await runStep({ label: 'y', script: tmpScript('process.exit(0)'), source: 'wishlist', timeoutMs: 5000 }, d.deps);
    assert.equal(ok.outcome, 'ok');
  } finally { console.error = origErr; console.log = origLog; }
  assert.equal(d.stale.length, 1);
});

// ── PR #10 리뷰: fmt 재귀 회귀 방지 + 실제 기본 상한값으로 1단계 로그 출력 확인 ──
const { spawnSync } = require('child_process');

test('fmt: 15분·17분·30초를 재귀 없이 표기', () => {
  const { fmt } = require('../../pipeline/run');
  assert.equal(fmt(15 * 60 * 1000), '15분');
  assert.equal(fmt(17 * 60 * 1000), '17분');
  assert.equal(fmt(30 * 1000), '30초');
});

test('run.js: 실제 기본 상한값(STEP_TIMEOUT_* 미설정)으로 1단계 로그까지 출력', () => {
  // 기본값을 쓰도록 STEP_TIMEOUT_* 를 제거한 새 프로세스에서 run.js를 로드하고,
  // 1단계 스크립트만 즉시 exit 0 하는 임시 파일로 바꿔 runStep 실행 (DB 불필요)
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith('STEP_TIMEOUT_')) delete env[k];
  const exitZero = tmpScript('process.exit(0)');
  const runJs = path.resolve(__dirname, '../../pipeline/run.js');
  const driver = `
    const { STEPS, runStep } = require(${JSON.stringify(runJs)});
    const step = { ...STEPS[0], script: ${JSON.stringify(exitZero)} };
    runStep(step, { today: '2026-11-05', failStaleRuns: async () => 0, alert: async () => {} })
      .then((r) => { console.log('OUTCOME=' + r.outcome + ' TIMEOUT_MS=' + step.timeoutMs); })
      .catch((e) => { console.error('ERR=' + e.message); process.exit(3); });
  `;
  const r = spawnSync(process.execPath, ['-e', driver], { env, encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, `driver 비정상 종료: ${r.stderr}`);
  assert.match(r.stdout, /\[1\/5 Most Played\] 실행 중\.\.\. \(상한 15분\)/);
  assert.match(r.stdout, /\[1\/5 Most Played\] 완료 ✅/);
  assert.match(r.stdout, /OUTCOME=ok TIMEOUT_MS=900000/);
});

// ── 단계 선택 (workflow_dispatch 입력 steps → PIPELINE_STEPS) ──────────
test('parseSteps: 비어 있음/all → 전체 + 신호 엔진', () => {
  const { parseSteps, STEPS } = require('../../pipeline/run');
  for (const input of [undefined, '', '  ', 'all', 'ALL', 'all,reviews']) {
    const r = parseSteps(input);
    assert.equal(r.steps, STEPS, `input=${JSON.stringify(input)}`);
    assert.equal(r.runEngine, true);
    assert.equal(r.label, 'all');
  }
});
test('parseSteps: reviews → 리뷰만, 신호 엔진 건너뜀', () => {
  const { parseSteps } = require('../../pipeline/run');
  const r = parseSteps('reviews');
  assert.deepEqual(r.steps.map((x) => x.source), ['reviews']);
  assert.equal(r.runEngine, false);
});
test('parseSteps: 공백·대소문자 허용, 정의 순서 유지, signal_engine은 명시 시에만', () => {
  const { parseSteps } = require('../../pipeline/run');
  const r = parseSteps(' Reviews , wishlist signal_engine ');
  assert.deepEqual(r.steps.map((x) => x.source), ['wishlist', 'reviews']);
  assert.equal(r.runEngine, true);
  assert.equal(r.label, 'wishlist,reviews,signal_engine');
  const onlyEngine = parseSteps('signal_engine');
  assert.deepEqual(onlyEngine.steps, []);
  assert.equal(onlyEngine.runEngine, true);
});
test('parseSteps: 모르는 단계명 → throw (아무것도 실행하지 않음)', () => {
  const { parseSteps } = require('../../pipeline/run');
  assert.throws(() => parseSteps('review'), /알 수 없는 단계: review .*사용 가능: all, most_played, wishlist, reviews, appdetails, signal_engine/);
});
test('run.js: PIPELINE_STEPS=reviews → 리뷰만 실행, 나머지·신호 엔진은 skipped (DB 없음)', () => {
  const env = { ...process.env, PIPELINE_STEPS: 'reviews', DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x' };
  delete env.GITHUB_STEP_SUMMARY;
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../../pipeline/run.js')], { env, encoding: 'utf8', timeout: 60000, cwd: path.resolve(__dirname, '../..') });
  const out = r.stdout + r.stderr;
  assert.match(out, /🧩 실행 단계: reviews \(신호 엔진 건너뜀\)/);
  assert.match(out, /\[3\/5 리뷰\] 실행 중\.\.\./);
  assert.doesNotMatch(out, /\[1\/5 Most Played\] 실행 중/);
  assert.match(out, /\[5\/5\] 신호 엔진 건너뜀/);
  assert.match(out, /\| 1\/5 Most Played \| ⏭️ skipped/);
  assert.match(out, /\| 5\/5 신호 엔진 \| ⏭️ skipped/);
  assert.equal(r.status, 1, 'DB가 없으니 리뷰 단계는 실패 → exit 1');
});
test('run.js: PIPELINE_STEPS 오타 → 아무 단계도 실행하지 않고 exit 1', () => {
  const env = { ...process.env, PIPELINE_STEPS: 'reveiws', DATABASE_URL: 'postgres://u:p@127.0.0.1:1/x' };
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '../../pipeline/run.js')], { env, encoding: 'utf8', timeout: 30000, cwd: path.resolve(__dirname, '../..') });
  const out = r.stdout + r.stderr;
  assert.equal(r.status, 1);
  assert.match(out, /알 수 없는 단계: reveiws/);
  assert.doesNotMatch(out, /실행 중\.\.\./);
});
