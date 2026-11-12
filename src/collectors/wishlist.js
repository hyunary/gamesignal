const axios = require('axios');
const pool = require('../db/pool');
const { upsertGame } = require('../db/queries');
const { withPipelineRun } = require('../utils/pipelineRun');
const { sleep } = require('../utils/sleep');
require('dotenv').config();

// ── 설정 (환경변수로 조정 가능) ──────────────────────────────────────
const STEAMSPY_URL = 'https://steamspy.com/api.php';
const TOP_N = 50;
const REQUEST_TIMEOUT_MS = 15000;
// 단계 전체 상한 — run.js 프로세스 상한(STEP_TIMEOUT_WISHLIST_MS 8분)보다 짧게 잡아
// kill 되기 전에 사유를 남기고 failed로 마감
const BUDGET_MS = parseInt(process.env.WISHLIST_BUDGET_MS) || 7.5 * 60 * 1000;
// 비정상 응답 시 재시도 대기 (1회만)
const RETRY_DELAY_MS = parseInt(process.env.WISHLIST_RETRY_DELAY_MS) || 2 * 60 * 1000;
// 목록 급변 판정: 기준일 Top 50과 겹치는 게임이 이 수 미만이면 failed (0이면 검사 끔)
const MIN_OVERLAP = Number.isNaN(parseInt(process.env.WISHLIST_MIN_OVERLAP))
  ? 15 : parseInt(process.env.WISHLIST_MIN_OVERLAP);
// 기준일로 인정할 최소 위시리스트 행 수 (저장 0건이었던 날은 기준에서 제외)
const BASELINE_MIN_ROWS = parseInt(process.env.WISHLIST_BASELINE_MIN_ROWS) || 40;
const BASELINE_LOOKBACK_DAYS = 7;

/**
 * SteamSpy top100in2weeks 응답 형식 검증 (순수 함수 — 테스트 대상)
 * 정상: { "<appid>": { appid, name, owners, ccu, ... }, ... }
 * 사유 코드 (모두 재시도 1회 대상):
 *   BLOCKED       : 429/403
 *   HTTP_xxx      : 200이 아닌 상태
 *   NON_JSON      : JSON이 아닌 응답 (예: "Connection failed: Too many connections", HTTP 200)
 *   NOT_OBJECT    : JSON이지만 객체가 아님 (배열, 숫자, null 등)
 *   EMPTY         : 빈 객체
 *   INVALID_ITEMS : 키가 숫자 appid가 아니거나 name이 없는 항목이 절반 이상
 * 통과 시 유효 항목만 반환 (절반 미만의 불량 항목은 버림)
 */
function validateSteamSpyResponse(status, rawBody) {
  const head = typeof rawBody === 'string' ? rawBody.slice(0, 300) : JSON.stringify(rawBody ?? null).slice(0, 300);
  const fail = (reason, extra = {}) => ({ ok: false, reason, retryable: true, status, head, ...extra });

  if (status === 429 || status === 403) return fail('BLOCKED');
  if (status !== 200) return fail(`HTTP_${status}`);

  let data = rawBody;
  if (typeof rawBody === 'string') {
    try { data = JSON.parse(rawBody); }
    catch { return fail('NON_JSON'); }
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return fail('NOT_OBJECT');

  const all = Object.entries(data);
  if (all.length === 0) return fail('EMPTY');

  const isValid = ([key, info]) =>
    /^\d+$/.test(key) &&
    info !== null && typeof info === 'object' && !Array.isArray(info) &&
    typeof info.name === 'string' && info.name.trim() !== '';
  const valid = all.filter(isValid);
  const invalid = all.length - valid.length;
  if (invalid * 2 >= all.length) {
    return fail('INVALID_ITEMS', { total: all.length, invalid });
  }
  return { ok: true, entries: valid, total: all.length, invalid };
}

// 유효 항목 → ccu 내림차순 Top 50 + 순위 (기존 로직 유지)
function rankWishlist(entries) {
  return entries
    .map(([appId, info]) => ({
      appId: parseInt(appId),
      title: info.name,
      owners: info.owners,
      players2weeks: info.ccu || 0,   // SteamSpy는 players_2weeks 미제공 → ccu 사용
    }))
    .sort((a, b) => b.players2weeks - a.players2weeks)
    .slice(0, TOP_N)
    .map((g, index) => ({ ...g, rank: index + 1 }));
}

/**
 * 목록 급변 감지 (순수 함수)
 * 평소 하루 변동은 몇 개 수준. 11/11처럼 대부분이 교체되면 원천 데이터 이상으로 본다.
 * 기준 목록이 없으면(첫 실행 등) 검사를 건너뛴다.
 */
function checkContinuity(todayIds, baselineIds, minOverlap = MIN_OVERLAP) {
  if (!baselineIds || baselineIds.length === 0 || minOverlap <= 0) {
    return { ok: true, skipped: true, overlap: null, baselineSize: baselineIds?.length ?? 0 };
  }
  const base = new Set(baselineIds.map(Number));
  const overlap = todayIds.filter((id) => base.has(Number(id))).length;
  return { ok: overlap >= minOverlap, skipped: false, overlap, baselineSize: base.size };
}

// SteamSpy 1회 호출 — 상태 코드·본문을 직접 판정하기 위해 axios 자동 throw/파싱 끔
async function fetchSteamSpyOnce() {
  try {
    const res = await axios.get(STEAMSPY_URL, {
      params: { request: 'top100in2weeks' },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    return validateSteamSpyResponse(res.status, res.data);
  } catch (e) {
    return { ok: false, reason: `NETWORK_${e.code || 'ERROR'}`, retryable: true, status: null, head: e.message };
  }
}

/**
 * 수집 본체 (네트워크·기준 목록·저장·시계 주입 가능 — 테스트 대상)
 *  1) 호출 → 형식 검증. 실패하면 RETRY_DELAY_MS 뒤 1회만 재시도 (상한 안에서만)
 *  2) 기준일 Top 50과 겹침 검사 — MIN_OVERLAP 미만이면 LIST_CHANGED
 *  3) 통과했을 때만 저장
 * 반환: { status: 'failed'|'ok', reason?, error?, games?, saved?, failed?, attempts }
 * failed면 save는 호출되지 않는다.
 */
async function runWishlistCollection(deps) {
  const {
    fetch = fetchSteamSpyOnce,
    loadBaseline,
    save,
    now = Date.now,
    wait = sleep,
    budgetMs = BUDGET_MS,
    retryDelayMs = RETRY_DELAY_MS,
    minOverlap = MIN_OVERLAP,
    log = console,
  } = deps;
  const deadline = now() + budgetMs;

  // 1) 호출 + 형식 검증 (2분 뒤 1회 재시도)
  let verdict = await fetch();
  let attempts = 1;
  if (!verdict.ok) {
    log.warn(`⚠️ SteamSpy 응답 이상: ${verdict.reason} (HTTP ${verdict.status ?? '-'}) 본문: ${String(verdict.head).replace(/\s+/g, ' ')}`);
    const canRetry = verdict.retryable && now() + retryDelayMs + REQUEST_TIMEOUT_MS <= deadline;
    if (canRetry) {
      log.warn(`   → ${Math.round(retryDelayMs / 1000)}초 뒤 1회 재시도`);
      await wait(retryDelayMs);
      verdict = await fetch();
      attempts++;
    } else {
      log.warn('   → 단계 상한 안에 재시도할 시간이 없어 재시도 생략');
    }
  }
  if (!verdict.ok) {
    const detail = verdict.reason === 'INVALID_ITEMS' ? ` (불량 ${verdict.invalid}/${verdict.total})` : '';
    return {
      status: 'failed', reason: verdict.reason, attempts,
      error: `${verdict.reason}${detail} · HTTP ${verdict.status ?? '-'} · 시도 ${attempts}회 · 본문: ${String(verdict.head).replace(/\s+/g, ' ')}`,
    };
  }
  const games = rankWishlist(verdict.entries);
  log.log(`✅ ${games.length}개 게임 수신 (응답 ${verdict.total}건, 불량 ${verdict.invalid}건 제외)`);

  // 2) 목록 급변 감지
  const baseline = await loadBaseline();
  const cont = checkContinuity(games.map((g) => g.appId), baseline?.ids, minOverlap);
  if (cont.skipped) {
    log.warn('⚠️ 비교할 기준 위시리스트가 없어 목록 급변 검사 생략');
  } else {
    log.log(`🔁 기준일 ${baseline.date} Top ${cont.baselineSize}과 겹침 ${cont.overlap}개 (최소 ${minOverlap})`);
  }
  if (!cont.ok) {
    const sample = games.slice(0, 5).map((g) => `${g.appId}:${g.title}`).join(', ');
    return {
      status: 'failed', reason: 'LIST_CHANGED', attempts, games,
      error: `LIST_CHANGED · 목록 급변: 기준일 ${baseline.date} Top ${cont.baselineSize}과 겹침 ${cont.overlap}개 (<${minOverlap}) · 오늘 상위 5: ${sample}`.slice(0, 2000),
    };
  }

  // 3) 검증 통과 → 저장 (순위 비교 기준일도 함께 전달 — 전날이 비어 있어도 전부 신규 진입으로 찍히지 않게)
  const { saved, failed } = await save(games, baseline);
  return { status: 'ok', attempts, games, saved, failed };
}

/**
 * 기준 위시리스트: 오늘 이전 7일 안에서 위시리스트 행이 BASELINE_MIN_ROWS 이상인 가장 최근 날
 * (저장 0건이었던 날은 건너뜀 — 예: 11/12)
 */
async function loadBaselineFromDb(today) {
  const { rows } = await pool.query(`
    SELECT snapshot_date::text AS date, array_agg(app_id) AS ids
    FROM game_snapshots
    WHERE snapshot_date <  $1::date
      AND snapshot_date >= $1::date - $2::int
      AND wishlist_rank IS NOT NULL
    GROUP BY snapshot_date
    HAVING COUNT(*) >= $3
    ORDER BY snapshot_date DESC
    LIMIT 1
  `, [today, BASELINE_LOOKBACK_DAYS, BASELINE_MIN_ROWS]);
  return rows[0] || null;
}

/**
 * 스냅샷 저장 (저장 컬럼·rank_change_flag 계산식은 기존과 동일)
 * 비교 기준: 기준일(baseline.date, 최근 7일 중 위시리스트가 채워진 가장 최근 날).
 * 기존처럼 '정확히 전날'과 비교하면 전날 수집이 실패(저장 0건)했을 때
 * Top 50 전부가 is_new_entry_wl=TRUE로 찍혀 가짜 신규 진입 신호가 쏟아진다.
 * 기준일이 없으면(첫 실행 등) 기존대로 전날과 비교.
 */
async function saveWishlistData(games, today, baseline = null) {
  console.log('\n💾 DB 저장 중...');
  const prevDate = baseline?.date ?? null;
  const prevDateSql = prevDate ? '$2::date' : '$2::date - 1';
  const prevRef = prevDate ?? today;
  console.log(`   순위 비교 기준일: ${prevDate ?? '전날'}`);
  let saved = 0;
  let failed = 0;
  for (const game of games) {
    try {
      // 게임 기본 정보 저장
      await upsertGame(game.appId, game.title);
      // 기준일 wishlist_rank 조회 (is_new_entry_wl / rank_change_flag 계산용)
      const { rows } = await pool.query(`
        SELECT wishlist_rank FROM game_snapshots
        WHERE app_id = $1
          AND snapshot_date = ${prevDateSql}
      `, [game.appId, prevRef]);
      const prevRank = rows[0]?.wishlist_rank ?? null;
      const isNewEntry = prevRank === null;
      // rank_change_flag 계산 (경계값: >= 5)
      let rankChangeFlag = null;
      if (prevRank !== null) {
        const delta = prevRank - game.rank;
        if (delta >= 5)       rankChangeFlag = 'surge';
        else if (delta <= -5) rankChangeFlag = 'drop';
        else                  rankChangeFlag = 'stable';
      }
      // 스냅샷 저장
      await pool.query(`
        INSERT INTO game_snapshots
          (app_id, snapshot_date, wishlist_rank, is_new_entry_wl, rank_change_flag)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (app_id, snapshot_date) DO UPDATE SET
          wishlist_rank    = EXCLUDED.wishlist_rank,
          is_new_entry_wl  = EXCLUDED.is_new_entry_wl,
          rank_change_flag = EXCLUDED.rank_change_flag,
          collected_at     = NOW()
      `, [game.appId, today, game.rank, isNewEntry, rankChangeFlag]);
      saved++;
    } catch (err) {
      failed++;
      console.error(`⚠️ 저장 실패 (${game.title}):`, err.message);
    }
  }
  if (saved === 0) throw new Error(`Wishlist 저장 0건 (저장 실패 ${failed}건)`);
  console.log(`✅ ${saved}개 게임 DB 저장 완료`);
  return { saved, failed };
}

/**
 * 메인: withPipelineRun으로 어떤 경로로 끝나든 pipeline_runs 마감
 * 검증 실패 시 저장·폴백 없이 failed + 사유/본문 앞 300자 기록.
 * (기존 fallbackToPreviousDay는 위시리스트가 아닌 Most Played 값을 복사하고
 *  CURRENT_DATE(UTC)로 전날 pipeline_runs 행을 덮어써서 이 경로에서 제거)
 */
async function collectWishlist() {
  console.log('⭐ SteamSpy Wishlist 수집 시작...');
  console.log(`   (상한 ${Math.round(BUDGET_MS / 1000)}초 · 이상 응답 시 ${Math.round(RETRY_DELAY_MS / 1000)}초 뒤 1회 재시도 · 급변 기준 겹침 ${MIN_OVERLAP}개)`);
  // KST 기준 오늘 날짜 (UTC+9)
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  let result = null;
  await withPipelineRun('wishlist', async (run) => {
    result = await runWishlistCollection({
      loadBaseline: () => loadBaselineFromDb(today),
      save: (games, baseline) => saveWishlistData(games, today, baseline),
    });
    if (result.status === 'failed') {
      run.status = 'failed';
      run.error  = result.error;
      console.error(`❌ Wishlist 저장 안 함 — ${result.error}`);
      return;
    }
    run.collected = result.saved;
    run.failed    = result.failed;
    run.expected  = result.games.length;
    // 미리보기
    console.log('\n📊 SteamSpy Top 10 미리보기:');
    result.games.slice(0, 10).forEach((g) =>
      console.log(`${String(g.rank).padStart(3)}위 | ${g.appId} | ${g.title} | ${g.players2weeks.toLocaleString()}명`));
  });
  return result;
}

module.exports = {
  validateSteamSpyResponse, rankWishlist, checkContinuity,
  runWishlistCollection, collectWishlist,
};

if (require.main === module) {
  collectWishlist()
    .then(async (r) => {
      await pool.end().catch(() => {});
      if (r?.status === 'failed') {
        console.error('\n❌ Wishlist 단계 failed');
        process.exit(1);
      }
      console.log(`\n🎉 완료! Wishlist ${r.games.length}개 수집, ${r.saved}개 저장됨`);
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ 파이프라인 실패:', err.message);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}
