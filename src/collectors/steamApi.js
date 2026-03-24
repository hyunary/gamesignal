const axios = require('axios');
const pool = require('../db/pool');
const { retryWithBackoff } = require('../utils/retry');
const { sleep } = require('../utils/sleep');
if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
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
    releaseDate:     d.release_date?.date ?? null,
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
    // 월요일: 전체 갱신
    console.log('📅 월요일 — 전체 게임 상세 정보 갱신');
    query = `SELECT app_id, title FROM games ORDER BY app_id`;
  } else {
    // 평일: developer가 없는 신규 게임만
    console.log('📅 평일 — 신규 게임만 상세 정보 수집');
    query = `SELECT app_id, title FROM games WHERE developer IS NULL ORDER BY app_id`;
  }
  const { rows: targets } = await pool.query(query);
  console.log(`📋 수집 대상: ${targets.length}개 게임`);
  if (targets.length === 0) {
    console.log('✅ 수집할 신규 게임 없음 — 완료');
    return [];
  }
  const results = { success: 0, failed: 0, filtered: 0 };
  for (const game of targets) {
    try {
      // API 호출 간격 1초 (Rate Limit 준수)
      await sleep(1000);
      const details = await retryWithBackoff(
        () => fetchAppDetails(game.app_id),
        { label: `appdetails(${game.app_id})`, maxRetries: 2, baseMs: 2000 }
      );
      await updateGameDetails(details);
      // DLC/소프트웨어/성인물 표시
      const flags = [];
      if (details.isDlc)      flags.push('DLC');
      if (details.isSoftware) flags.push('SW');
      if (details.isAdultOnly) flags.push('Adult');
      const flagStr = flags.length > 0 ? ` [${flags.join('/')}]` : '';
      console.log(`  ✅ ${game.title}${flagStr}`);
      results.success++;
    } catch (err) {
      console.warn(`  ⚠️ 실패 (${game.title}): ${err.message}`);
      results.failed++;
    }
  }
  console.log(`\n📊 결과: 성공 ${results.success}개 / 실패 ${results.failed}개`);
  return results;
}
module.exports = { collectAppDetails, fetchAppDetails, updateGameDetails };
// 직접 실행 시
if (require.main === module) {
  collectAppDetails()
    .then(() => {
      console.log('\n🎉 appdetails 수집 완료!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ 실패:', err.message);
      process.exit(1);
    });
}
