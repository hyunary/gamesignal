const axios = require('axios');
const pool = require('../db/pool');
const { retryWithBackoff } = require('../utils/retry');
const { withPipelineRun, deriveStatus } = require('../utils/pipelineRun');
const { sleep } = require('../utils/sleep');
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
// 단계 시간 상한 — 초과 시 남은 게임은 다음 배치로 미루고 partial 마감 (신호 엔진 보장)
const BUDGET_MS = parseInt(process.env.APPDETAILS_BUDGET_MS) || 15 * 60 * 1000;
// 연속 차단 시 중단 (같은 IP로 계속 호출해도 의미 없음)
const MAX_CONSECUTIVE_BLOCKS = parseInt(process.env.APPDETAILS_MAX_CONSECUTIVE_BLOCKS) || 5;
// 게임 상세 정보 수집 (appdetails API)
async function fetchAppDetails(appId) {
  const { data } = await axios.get(
    'https://store.steampowered.com/api/appdetails',
    {
      params: { appids: appId, l: 'english' },
      timeout: 10000
    }
  );
  const appData = data[appId];
  if (!appData?.success || !appData?.data) {
    throw new Error(`appdetails 없음: ${appId}`);
  }
  const d = appData.data;
  return {
    appId,
    title:           d.name,
    developer:       d.developers?.[0] ?? null,
    publisher:       d.publishers?.[0] ?? null,
    releaseDate: (() => {
      const raw = d.release_date?.date;
      if (!raw || raw.trim() === '' || raw.toLowerCase().includes('announced')) return null;
      // 날짜 형식 검증
      const parsed = new Date(raw);
      if (isNaN(parsed.getTime())) return null;
      return raw;
    })(),
    genres:          d.genres?.map(g => g.description) ?? [],
    tags:            d.categories?.map(c => c.description) ?? [],
    isEarlyAccess:   d.genres?.some(g => g.description === 'Early Access') ?? false,
    isFreeToPlay:    d.is_free ?? false,
    isAdultOnly:     d.content_descriptors?.ids?.includes(3) ?? false,
    isDlc:           d.type === 'dlc',
    isSoftware:      d.type === 'game' ? false : d.type === 'software',
    headerImageUrl:  d.header_image ?? null,
    trailerSteamUrl: d.movies?.[0]?.webm?.max ?? null,
  };
}
// games 테이블 상세 업데이트
async function updateGameDetails(details) {
  await pool.query(`
    UPDATE games SET
      title           = CASE WHEN title LIKE 'Game\\_%' AND $14::text IS NOT NULL AND $14::text <> '' THEN $14::text ELSE title END,
      developer       = $2,
      publisher       = $3,
      release_date    = $4,
      genres          = $5,
      tags            = $6,
      is_early_access = $7,
      is_free_to_play = $8,
      is_adult_only   = $9,
      is_dlc          = $10,
      is_software     = $11,
      header_image_url   = $12,
      trailer_steam_url  = $13,
      updated_at      = NOW()
    WHERE app_id = $1
  `, [
    details.appId,
    details.developer,
    details.publisher,
    details.releaseDate,
    details.genres,
    details.tags,
    details.isEarlyAccess,
    details.isFreeToPlay,
    details.isAdultOnly,
    details.isDlc,
    details.isSoftware,
    details.headerImageUrl,
    details.trailerSteamUrl,
    details.title ?? null,
  ]);
}
// 신규 App ID만 수집 (기존 게임은 월요일에만 갱신)
async function collectAppDetails() {
  console.log('🎮 Steam appdetails 수집 시작...');
  const today = new Date();
  const isMonday = today.getDay() === 1;
  // 수집 대상 결정
  let query;
  if (isMonday) {
    // 월요일: 전체 갱신 — 시간 상한에 걸려도 오래된 것부터 갱신되도록 updated_at 오름차순
    console.log('📅 월요일 — 전체 게임 상세 정보 갱신');
    query = `SELECT app_id, title FROM games ORDER BY updated_at ASC NULLS FIRST, app_id`;
  } else {
    // 평일: developer가 없는 신규 게임 + 임시 이름(Game_{appid}) 게임
    console.log('📅 평일 — 신규 게임만 상세 정보 수집');
    query = `SELECT app_id, title FROM games WHERE developer IS NULL OR title LIKE 'Game\\_%' ORDER BY app_id`;
  }
  return withPipelineRun('appdetails', async (run) => {
    const { rows: targets } = await pool.query(query);
    run.expected = targets.length;
    console.log(`📋 수집 대상: ${targets.length}개 게임 (시간 상한 ${Math.round(BUDGET_MS / 60000)}분)`);
    if (targets.length === 0) {
      console.log('✅ 수집할 신규 게임 없음 — 완료');
      run.status = 'success';
      return { success: 0, failed: 0, skipped: 0, status: 'success' };
    }
    const deadline = Date.now() + BUDGET_MS;
    const results = { success: 0, failed: 0, skipped: 0, blocked: 0, aborted: null };
    let consecutiveBlocks = 0;
    for (let i = 0; i < targets.length; i++) {
      const game = targets[i];
      if (Date.now() >= deadline) {
        results.aborted = 'BUDGET';
        results.skipped += targets.length - i;
        console.warn(`  ⏱️ 시간 상한 도달 → 남은 ${targets.length - i}개는 다음 배치로`);
        break;
      }
      try {
        // API 호출 간격 1초 (Rate Limit 준수)
        await sleep(1000);
        const details = await retryWithBackoff(
          () => fetchAppDetails(game.app_id),
          // 429/403은 15분 대기 없이 해당 게임만 건너뜀
          { label: `appdetails(${game.app_id})`, maxRetries: 2, baseMs: 2000, skipOnBlock: true }
        );
        await updateGameDetails(details);
        consecutiveBlocks = 0;
        // DLC/소프트웨어/성인물 표시
        const flags = [];
        if (details.isDlc)      flags.push('DLC');
        if (details.isSoftware) flags.push('SW');
        if (details.isAdultOnly) flags.push('Adult');
        const flagStr = flags.length > 0 ? ` [${flags.join('/')}]` : '';
        console.log(`  ✅ ${game.title}${flagStr}`);
        results.success++;
      } catch (err) {
        if (err.isBlocked) {
          results.blocked++;
          results.skipped++;
          consecutiveBlocks++;
          if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
            results.aborted = 'BLOCKED';
            results.skipped += targets.length - i - 1;
            console.warn(`  ⛔ 연속 차단 ${consecutiveBlocks}회 → 남은 ${targets.length - i - 1}개 건너뜀`);
            break;
          }
        } else {
          consecutiveBlocks = 0;
          console.warn(`  ⚠️ 실패 (${game.title}): ${err.message}`);
          results.failed++;
        }
      }
    }
    run.collected = results.success;
    run.failed    = results.failed + results.blocked;
    run.skipped   = results.skipped;
    run.status    = deriveStatus(run);
    if (run.status !== 'success') {
      run.error = `${results.success}/${targets.length} 성공 · 실패 ${results.failed} · 차단 ${results.blocked}` +
        (results.aborted ? ` · 중단: ${results.aborted}` : '');
    }
    console.log(`\n📊 결과: 성공 ${results.success}개 / 실패 ${results.failed}개 / 차단 ${results.blocked}개 / 건너뜀 ${results.skipped}개 → ${run.status}`);
    return { ...results, status: run.status };
  });
}
module.exports = { collectAppDetails, fetchAppDetails, updateGameDetails };
// 직접 실행 시
if (require.main === module) {
  collectAppDetails()
    .then(async (r) => {
      await pool.end().catch(() => {});
      if (r?.status === 'failed') {
        console.error('\n❌ appdetails 수집 실패 (성공 0건)');
        process.exit(1);
      }
      console.log('\n🎉 appdetails 수집 완료!');
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ 실패:', err.message);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}
