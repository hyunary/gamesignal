// 파이프라인 복원력 단위 테스트 — DB·네트워크 불필요 (node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  classifyReviewResponse, collectReviewsCore, fetchWithRetry, summarizeReasons,
} = require('../../src/collectors/reviews');
const { withPipelineRun, deriveStatus } = require('../../src/utils/pipelineRun');
const { retryWithBackoff } = require('../../src/utils/retry');
const { runStep } = require('../../pipeline/run');

const quietLog = { log() {}, warn() {}, error() {} };
const noWait = async () => {};

// ── 10. 리뷰 응답 판정 ───────────────────────────────────────────────
test('classify: 정상 응답 → ok', () => {
  const body = JSON.stringify({ success: 1, query_summary: { total_reviews: 120, total_positive: 100, total_negative: 20 } });
  const v = classifyReviewResponse(1, 200, body);
  assert.equal(v.ok, true);
  assert.deepEqual(v.reviews, { appId: 1, reviewTotal: 120, reviewPositive: 100, reviewNegative: 20 });
});
test('classify: 리뷰 0건 신작 → 실패가 아니라 ok (0 저장)', () => {
  const v = classifyReviewResponse(2, 200, '{"success":1,"query_summary":{"num_reviews":0,"total_reviews":0,"total_positive":0,"total_negative":0}}');
  assert.equal(v.ok, true);
  assert.equal(v.reviews.reviewTotal, 0);
});
test('classify: 429/403 → BLOCKED, 재시도 안 함', () => {
  for (const s of [429, 403]) {
    const v = classifyReviewResponse(3, s, 'Too Many Requests');
    assert.equal(v.reason, 'BLOCKED'); assert.equal(v.retryable, false);
  }
});
test('classify: 5xx → 재시도, 404 → 재시도 안 함', () => {
  assert.equal(classifyReviewResponse(4, 502, '').retryable, true);
  const v = classifyReviewResponse(4, 404, '');
  assert.equal(v.reason, 'HTTP_404'); assert.equal(v.retryable, false);
});
test('classify: HTML 응답 → NON_JSON + 본문 앞 300자 보존', () => {
  const html = '<!DOCTYPE html><html>' + 'x'.repeat(1000);
  const v = classifyReviewResponse(5, 200, html);
  assert.equal(v.reason, 'NON_JSON');
  assert.equal(v.head.length, 300);
});
test('classify: success≠1 → API_SUCCESS_n, summary 없음 → NO_SUMMARY', () => {
  assert.equal(classifyReviewResponse(6, 200, '{"success":2}').reason, 'API_SUCCESS_2');
  assert.equal(classifyReviewResponse(6, 200, '{"success":1}').reason, 'NO_SUMMARY');
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
    fetch: async (id) => { throw Object.assign(new Error('x'), { reason: 'API_SUCCESS_2', status: 200, head: `{"success":2} ${id}` }); },
    save: async () => {}, wait: noWait, intervalMs: 0, log: quietLog,
  });
  assert.equal(stats.saved, 0);
  assert.equal(stats.reasons.API_SUCCESS_2.count, 3);
  assert.equal(stats.reasons.API_SUCCESS_2.sample.appId, 1000);
  assert.match(summarizeReasons(stats, 3), /0\/3 저장 · 실패 사유: API_SUCCESS_2×3/);
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
