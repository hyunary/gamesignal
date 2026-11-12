// wishlist 응답 검증·목록 급변·신호 엔진 연동 단위 테스트 — DB·네트워크 불필요 (node --test)
// 이 파일은 별도 프로세스로 실행되므로 require 캐시 스텁이 다른 테스트에 영향 없음
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  validateSteamSpyResponse, checkContinuity, runWishlistCollection,
} = require('../../src/collectors/wishlist');

const quietLog = { log() {}, warn() {}, error() {} };

// 11/12 확정 응답 원문 (39자, HTTP 200 추정)
const TOO_MANY = 'Connection failed: Too many connections';

// 정상 SteamSpy 응답 생성: appId 시작값부터 n개
function steamSpyBody(startId, n) {
  const o = {};
  for (let i = 0; i < n; i++) {
    const id = startId + i;
    o[id] = { appid: id, name: `Game ${id}`, owners: '1,000 .. 2,000', ccu: 100000 - i };
  }
  return JSON.stringify(o);
}
const ids = (startId, n) => Array.from({ length: n }, (_, i) => startId + i);

// ── 1. 응답 형식 검증 ────────────────────────────────────────────────
test('validate: 문자열 응답 "Connection failed: Too many connections" → NON_JSON, 원문 보존', () => {
  assert.equal(TOO_MANY.length, 39);
  const v = validateSteamSpyResponse(200, TOO_MANY);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'NON_JSON');
  assert.equal(v.retryable, true);
  assert.equal(v.head, TOO_MANY);
});
test('validate: 배열 응답 → NOT_OBJECT', () => {
  const v = validateSteamSpyResponse(200, '[{"appid":440,"name":"Team Fortress 2"},{"appid":550,"name":"Left 4 Dead 2"}]');
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'NOT_OBJECT');
});
test('validate: 숫자·null·빈 객체·429', () => {
  assert.equal(validateSteamSpyResponse(200, '42').reason, 'NOT_OBJECT');
  assert.equal(validateSteamSpyResponse(200, 'null').reason, 'NOT_OBJECT');
  assert.equal(validateSteamSpyResponse(200, '{}').reason, 'EMPTY');
  assert.equal(validateSteamSpyResponse(429, '').reason, 'BLOCKED');
  assert.equal(validateSteamSpyResponse(502, '').reason, 'HTTP_502');
});
test('validate: 키가 숫자 appid가 아니거나 name 없는 항목이 절반 이상 → INVALID_ITEMS', () => {
  const half = JSON.stringify({ 440: { name: 'TF2' }, 550: { name: 'L4D2' }, foo: { name: 'x' }, 730: { ccu: 1 } });
  const v = validateSteamSpyResponse(200, half);
  assert.equal(v.reason, 'INVALID_ITEMS');
  assert.equal(v.invalid, 2);
  assert.equal(v.total, 4);
});
test('validate: 불량 항목이 절반 미만이면 통과하고 불량은 버림', () => {
  const body = JSON.stringify({ 440: { name: 'TF2' }, 550: { name: 'L4D2' }, 730: { name: 'CS2' }, x: {} });
  const v = validateSteamSpyResponse(200, body);
  assert.equal(v.ok, true);
  assert.equal(v.entries.length, 3);
  assert.equal(v.invalid, 1);
});

// ── 2. 목록 급변 감지 ────────────────────────────────────────────────
test('checkContinuity: 겹침 15개 미만 → 실패, 15개 → 통과, 기준 없음 → 건너뜀', () => {
  const base = ids(1000, 50);
  assert.equal(checkContinuity([...ids(1000, 14), ...ids(9000, 36)], base, 15).ok, false);
  assert.equal(checkContinuity([...ids(1000, 15), ...ids(9000, 35)], base, 15).ok, true);
  assert.equal(checkContinuity(ids(9000, 50), [], 15).skipped, true);
  assert.equal(checkContinuity(ids(9000, 50), null, 15).skipped, true);
  assert.equal(checkContinuity(ids(9000, 50), base, 0).skipped, true, 'minOverlap 0이면 검사 끔');
});

// ── 수집 본체: 재시도·failed 시 저장 안 함 ───────────────────────────
function harness({ responses, baseline = { date: '2026-11-10', ids: ids(1000, 50) }, budgetMs = 450000 }) {
  let t = 0;
  const calls = { fetch: 0, waits: [], saved: null };
  const deps = {
    fetch: async () => { const body = responses[Math.min(calls.fetch, responses.length - 1)]; calls.fetch++; return validateSteamSpyResponse(200, body); },
    loadBaseline: async () => baseline,
    save: async (games, base) => { calls.saved = games; calls.saveBaseline = base; return { saved: games.length, failed: 0 }; },
    now: () => t,
    wait: async (ms) => { calls.waits.push(ms); t += ms; },
    budgetMs, retryDelayMs: 120000, minOverlap: 15, log: quietLog,
  };
  return { deps, calls };
}

test('collect: 문자열 응답 2회 → 2분 뒤 1회만 재시도 후 failed, 저장 안 함, 사유·본문 기록', async () => {
  const h = harness({ responses: [TOO_MANY, TOO_MANY] });
  const r = await runWishlistCollection(h.deps);
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'NON_JSON');
  assert.equal(r.attempts, 2);
  assert.deepEqual(h.calls.waits, [120000], '2분 대기 1회');
  assert.equal(h.calls.fetch, 2, '재시도는 1회만');
  assert.equal(h.calls.saved, null, '저장 호출 안 됨');
  assert.match(r.error, /NON_JSON · HTTP 200 · 시도 2회 · 본문: Connection failed: Too many connections/);
});
test('collect: 문자열 응답 후 재시도 성공 → 저장', async () => {
  const h = harness({ responses: [TOO_MANY, steamSpyBody(1000, 100)] });
  const r = await runWishlistCollection(h.deps);
  assert.equal(r.status, 'ok');
  assert.equal(r.attempts, 2);
  assert.equal(h.calls.saved.length, 50);
});
test('collect: 배열 응답 → failed, 저장 안 함', async () => {
  const arr = '[{"appid":440,"name":"Team Fortress 2"}]';
  const h = harness({ responses: [arr, arr] });
  const r = await runWishlistCollection(h.deps);
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'NOT_OBJECT');
  assert.equal(h.calls.saved, null);
});
test('collect: 목록 급변(기준일 Top 50과 겹침 10개) → LIST_CHANGED failed, 재시도·저장 안 함', async () => {
  // 오늘 응답: 기존 10개 + 처음 보는 90개 (11/11 누적 인기 목록 상황 재현)
  const o = JSON.parse(steamSpyBody(9000, 90));
  for (const id of ids(1000, 10)) o[id] = { appid: id, name: `Game ${id}`, ccu: 200000 };
  const h = harness({ responses: [JSON.stringify(o)] });
  const r = await runWishlistCollection(h.deps);
  assert.equal(r.status, 'failed');
  assert.equal(r.reason, 'LIST_CHANGED');
  assert.match(r.error, /기준일 2026-11-10 Top 50과 겹침 10개 \(<15\)/);
  assert.equal(h.calls.fetch, 1);
  assert.equal(h.calls.saved, null);
});
test('collect: 평소 수준 변동(겹침 47개) → 저장', async () => {
  const o = JSON.parse(steamSpyBody(1003, 47));
  Object.assign(o, JSON.parse(steamSpyBody(5000, 3)));
  const h = harness({ responses: [JSON.stringify(o)] });
  const r = await runWishlistCollection(h.deps);
  assert.equal(r.status, 'ok');
  assert.equal(h.calls.saved.length, 50);
});
test('collect: 저장 시 순위 비교 기준일을 함께 넘김 (전날 0건이어도 전부 신규 진입 되지 않게)', async () => {
  const base = { date: '2026-11-10', ids: ids(1000, 50) };
  const h = harness({ responses: [steamSpyBody(1000, 100)], baseline: base });
  await runWishlistCollection(h.deps);
  assert.equal(h.calls.saveBaseline, base);
});
test('collect: 기준 목록 없음 → 급변 검사 생략하고 저장', async () => {
  const h = harness({ responses: [steamSpyBody(9000, 100)], baseline: null });
  const r = await runWishlistCollection(h.deps);
  assert.equal(r.status, 'ok');
});
test('collect: 상한 안에 2분 재시도할 시간이 없으면 재시도 생략하고 failed', async () => {
  const h = harness({ responses: [TOO_MANY, steamSpyBody(1000, 100)], budgetMs: 60000 });
  const r = await runWishlistCollection(h.deps);
  assert.equal(r.status, 'failed');
  assert.equal(r.attempts, 1);
  assert.deepEqual(h.calls.waits, []);
});

// ── 3. 신호 엔진: 당일 wishlist failed면 S3·new_entry_wl 건너뜀 ─────────
const root = path.resolve(__dirname, '../..');
const stubbed = {};
function stub(rel, exports) {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
  stubbed[rel] = exports;
}
const state = { wishlistStatus: null, calls: [], emitted: [], sql: [] };
stub('src/db/pool.js', {
  query: async (sql) => {
    state.sql.push(sql);
    if (/FROM game_snapshots s\s+JOIN games g USING\(app_id\)\s+WHERE s.snapshot_date = \$1\s+AND \(s.is_new_entry_mp/.test(sql)) {
      return { rows: [{ app_id: 1, title: 'A', is_new_entry_mp: false, is_new_entry_wl: true, wishlist_rank: 3, genres: [] }] };
    }
    if (/COUNT\(DISTINCT app_id\)/.test(sql)) return { rows: [{ count: '0' }] };
    return { rows: [] };
  },
  end: async () => {},
});
stub('src/db/queries.js', {
  startPipelineRun: async () => 'run-x',
  finishPipelineRun: async () => {},
  getRunStatus: async (date, source) => { state.calls.push(['getRunStatus', date, source]); return state.wishlistStatus; },
});
stub('src/signals/filters.js', { shouldSuppress: async () => null });
stub('src/signals/emit.js', { emitSignal: async (appId, d, type) => { state.emitted.push(type); return true; } });
stub('src/signals/signal2.js', { detectTrafficRevival: async () => { state.calls.push(['S2']); return 0; } });
stub('src/signals/signal3.js', { detectWishlistSurge: async () => { state.calls.push(['S3']); return 0; } });
stub('src/signals/signal4.js', { detectReviewSpike: async () => { state.calls.push(['S4']); return 0; } });
stub('src/signals/signal5.js', { detectComposite: async () => { state.calls.push(['S5']); return 0; } });
stub('src/notifications/discord.js', { sendSignalAlert: async () => {}, sendPipelineSuccess: async () => {}, sendPipelineAlert: async () => {} });
stub('src/collectors/youtubeSentiment.js', { analyzeGameSentiment: async () => {} });

const { runSignalEngine } = require('../../src/signals/engine');
async function runEngineWith(status) {
  state.wishlistStatus = status; state.calls = []; state.emitted = []; state.sql = [];
  const origLog = console.log; const origWarn = console.warn;
  console.log = () => {}; console.warn = () => {};
  try { await runSignalEngine(); } finally { console.log = origLog; console.warn = origWarn; }
}

test('engine: 당일 wishlist failed → S3 건너뛰고 new_entry_wl 미발생, 나머지 신호는 실행', async () => {
  await runEngineWith('failed');
  assert.equal(state.calls[0][0], 'getRunStatus');
  assert.equal(state.calls[0][2], 'wishlist');
  const steps = state.calls.map((c) => c[0]);
  assert.ok(!steps.includes('S3'), 'S3 건너뜀');
  assert.deepEqual(steps.filter((x) => /^S\d/.test(x)), ['S2', 'S4', 'S5']);
  assert.ok(!state.emitted.includes('new_entry_wl'), 'new_entry_wl 미발생');
  const s1Sql = state.sql.find((q) => /AND \(s.is_new_entry_mp/.test(q));
  assert.doesNotMatch(s1Sql, /is_new_entry_wl = TRUE/, 'S1 쿼리에서 위시리스트 조건 제외');
});
test('engine: 당일 wishlist success/기록 없음 → S3와 new_entry_wl 정상 실행', async () => {
  for (const status of ['success', 'partial', null]) {
    await runEngineWith(status);
    const steps = state.calls.map((c) => c[0]);
    assert.ok(steps.includes('S3'), `status=${status}: S3 실행`);
    assert.ok(state.emitted.includes('new_entry_wl'), `status=${status}: new_entry_wl 발생`);
  }
});
