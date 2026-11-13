// S3 기준일·간격 보정·null 표기·getRunStatus 단위 테스트 — DB·네트워크 불필요 (node --test)
// 별도 프로세스로 실행되므로 require 캐시 스텁이 다른 테스트에 영향 없음
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const root = path.resolve(__dirname, '../..');
function stub(rel, exports) {
  const file = require.resolve(path.join(root, rel));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// ── 가짜 DB: SQL 패턴으로 응답 ───────────────────────────────────────
const db = { baseline: null, surgeRows: [], prevRanks: {}, prevQueryDates: [], runs: [] };
const fakePool = {
  query: async (sql, params = []) => {
    if (/array_agg\(app_id\)/.test(sql)) {
      return { rows: db.baseline ? [{ date: db.baseline.date, ids: db.baseline.ids }] : [] };
    }
    if (/rank_change_flag = 'surge'/.test(sql)) return { rows: db.surgeRows };
    if (/SELECT wishlist_rank FROM game_snapshots/.test(sql)) {
      db.prevQueryDates.push(params[1]);
      const r = db.prevRanks[params[0]];
      return { rows: r === undefined ? [] : [{ wishlist_rank: r }] };
    }
    if (/FROM pipeline_runs/.test(sql)) {
      // SQL에 적힌 정렬·LIMIT만 흉내 냄 (없으면 저장 순서 그대로)
      let rows = db.runs.filter((r) => r.run_date === params[0] && r.source === params[1]);
      if (/ORDER BY started_at DESC/.test(sql)) rows = [...rows].sort((a, b) => b.started_at - a.started_at);
      if (/LIMIT 1/.test(sql)) rows = rows.slice(0, 1);
      return { rows };
    }
    return { rows: [] };
  },
  end: async () => {},
};
stub('src/db/pool.js', fakePool);
const emitted = [];
stub('src/signals/filters.js', { shouldSuppress: async () => null });
stub('src/signals/emit.js', { emitSignal: async (appId, d, type, prio, payload) => { emitted.push({ appId, type, payload }); return true; } });

const { detectWishlistSurge } = require('../../src/signals/signal3');
const { daysBetween } = require('../../src/db/wishlistBaseline');
const { surgeLabel } = require('../../src/signals/format');
const { buildDescription } = require('../../src/notifications/discord');
const { getRunStatus } = require('../../src/db/queries');

const TODAY = '2026-11-13';
async function runS3({ baseline, surgeRows = [], prevRanks = {} }) {
  Object.assign(db, { baseline, surgeRows, prevRanks, prevQueryDates: [] });
  emitted.length = 0;
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  let n;
  try { n = await detectWishlistSurge(TODAY); } finally { console.log = orig; }
  return { n, logs, text: logs.join('\n') };
}
const ids50 = Array.from({ length: 50 }, (_, i) => i + 1);

// ── 기준일 간격별 S3 동작 ─────────────────────────────────────────────
test('S3 간격 1일(기준 11/12): 기준일 순위로 발송, payload에 baseline_date, 로그 "31위→8위, +23계단 (기준 11/12)"', async () => {
  const r = await runS3({
    baseline: { date: '2026-11-12', ids: ids50 },
    surgeRows: [{ app_id: 1, title: 'Alpha', wishlist_rank: 8 }],
    prevRanks: { 1: 31 },
  });
  assert.equal(r.n, 1);
  assert.deepEqual(emitted[0].payload, { curr_rank: 8, prev_rank: 31, change: 23, baseline_date: '2026-11-12' });
  assert.deepEqual(db.prevQueryDates, ['2026-11-12'], '이전 순위는 기준일에서 읽음');
  assert.match(r.text, /✅ wishlist_surge: Alpha \(31위→8위, \+23계단 \(기준 11\/12\)\)/);
});
test('S3 간격 3일(기준 11/10, 11/11~12 비어 있음): 감지 건너뛰고 사유 로그, 발송 0건', async () => {
  const r = await runS3({
    baseline: { date: '2026-11-10', ids: ids50 },
    surgeRows: [{ app_id: 1, title: 'Alpha', wishlist_rank: 7 }],
    prevRanks: { 1: 31 },
  });
  assert.equal(r.n, 0);
  assert.equal(emitted.length, 0);
  assert.deepEqual(db.prevQueryDates, [], '건너뛰면 순위 조회도 안 함');
  assert.match(r.text, /\[S3\] SKIP: 기준일 간격 3일 \(기준 11\/10\)/);
});
test('S3 기준일 없음: 건너뛰고 사유 로그, 발송 0건', async () => {
  const r = await runS3({ baseline: null, surgeRows: [{ app_id: 1, title: 'Alpha', wishlist_rank: 7 }] });
  assert.equal(r.n, 0);
  assert.equal(emitted.length, 0);
  assert.match(r.text, /\[S3\] SKIP: 최근 7일 안에 기준 위시리스트 없음/);
});
test('S3 기준일에 이전 순위가 없는 게임: 발송하지 않고 SKIP(NO_PREV_RANK) 로그', async () => {
  const r = await runS3({
    baseline: { date: '2026-11-12', ids: ids50 },
    surgeRows: [{ app_id: 1, title: 'Alpha', wishlist_rank: 8 }, { app_id: 2, title: 'Beta', wishlist_rank: 7 }],
    prevRanks: { 1: 31 },
  });
  assert.equal(r.n, 1);
  assert.deepEqual(emitted.map((e) => e.appId), [1]);
  assert.match(r.text, /SKIP\(NO_PREV_RANK\): Beta — 기준일 11\/12에 위시리스트 순위 없음/);
});

// ── "null" 표기 금지 ──────────────────────────────────────────────────
test('메시지·로그에 "null"이 들어가지 않음 (S3 로그, Discord 본문, 이전 버전 payload)', async () => {
  const r = await runS3({
    baseline: { date: '2026-11-12', ids: ids50 },
    surgeRows: [{ app_id: 1, title: 'Alpha', wishlist_rank: 8 }, { app_id: 2, title: 'Beta', wishlist_rank: 7 }],
    prevRanks: { 1: 31 },
  });
  assert.doesNotMatch(r.text, /null/i);
  const desc = buildDescription('wishlist_surge', emitted[0].payload, null);
  assert.match(desc, /31위→8위, \+23계단 \(기준 11\/12\)/);
  assert.doesNotMatch(desc, /null/i);
  // 11/13에 이미 쌓인 형태(prev_rank·change null, baseline_date 없음)로도 null 미표기
  const legacy = buildDescription('wishlist_surge', { curr_rank: 7, prev_rank: null, change: null }, null);
  assert.doesNotMatch(legacy, /null/i);
  assert.match(legacy, /7위 \(이전 순위 확인 불가\)/);
});
test('surgeLabel: 요청 형식 "31위→8위, +23계단 (기준 11/10)"', () => {
  assert.equal(surgeLabel({ prev_rank: 31, curr_rank: 8, change: 23, baseline_date: '2026-11-10' }), '31위→8위, +23계단 (기준 11/10)');
  assert.equal(surgeLabel({ prev_rank: 31, curr_rank: 8, change: 23 }), '31위→8위, +23계단');
});
test('daysBetween: 기준일 간격 계산 (월 경계 포함)', () => {
  assert.equal(daysBetween('2026-11-12', '2026-11-13'), 1);
  assert.equal(daysBetween('2026-11-10', '2026-11-13'), 3);
  assert.equal(daysBetween('2026-10-31', '2026-11-01'), 1);
});

// ── getRunStatus: 같은 날 여러 행이면 최신 실행 ────────────────────────
test('getRunStatus: 같은 날 두 행 중 started_at 최신 status 반환 (저장 순서 무관)', async () => {
  const morning = { run_date: TODAY, source: 'wishlist', status: 'failed', started_at: Date.parse('2026-11-12T21:00:00Z') };
  const evening = { run_date: TODAY, source: 'wishlist', status: 'success', started_at: Date.parse('2026-11-13T09:00:00Z') };
  db.runs = [morning, evening];
  assert.equal(await getRunStatus(TODAY, 'wishlist'), 'success');
  db.runs = [evening, morning];
  assert.equal(await getRunStatus(TODAY, 'wishlist'), 'success');
  db.runs = [];
  assert.equal(await getRunStatus(TODAY, 'wishlist'), null);
});
