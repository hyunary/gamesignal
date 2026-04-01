const axios = require('axios');
const pool = require('../db/pool');
const { startPipelineRun, finishPipelineRun } = require('../db/queries');
const { retryWithBackoff } = require('../utils/retry');
const { fallbackToPreviousDay } = require('../utils/fallback');
const { sleep } = require('../utils/sleep');
require('dotenv').config();
// Steam 리뷰 수집 (ISteamUserReviews API)
async function fetchReviews(appId) {
  // 1차 호출: 전체 리뷰 집계
  const { data: allData } = await axios.get(
    `https://store.steampowered.com/appreviews/${appId}`,
    {
      params: {
        json: 1,
        purchase_type: 'all',
        language: 'all',
        num_per_page: 0
      },
      timeout: 10000
    }
  );
  if (!allData?.success) throw new Error(`리뷰 API 실패: ${appId}`);
  await sleep(500);
  // 2차 호출: 최근 30일 리뷰 수 (day_range=30)
  const { data: recentData } = await axios.get(
    `https://store.steampowered.com/appreviews/${appId}`,
    {
      params: {
        json: 1,
        purchase_type: 'all',
        language: 'all',
        num_per_page: 0,
        filter: 'recent',
        day_range: 30
      },
      timeout: 10000
    }
  );
  const s  = allData.query_summary;
  const s2 = recentData.query_summary;
  return {
    appId,
    reviewTotal:    s.total_reviews  ?? 0,
    reviewPositive: s.total_positive ?? 0,
    reviewNegative: s.total_negative ?? 0,
    review30d:      s2.total_reviews ?? 0,   // 최근 30일 집계
  };
}
// review_spike 계산
async function calcReviewSpike(appId, today, review30d, reviewTotal) {
  // 전일 review_30d 조회
  const { rows } = await pool.query(`
    SELECT review_30d FROM game_snapshots
    WHERE app_id = $1
      AND snapshot_date = $2::date - 1
  `, [appId, today]);
  const prev30d = rows[0]?.review_30d ?? null;
  // review_spike 조건:
  // 1. review_total >= 100 (노이즈 방지)
  // 2. review_30d >= prev_30d * 1.20 (20% 이상 증가)
  // 3. 전일 데이터 있어야 함
  if (prev30d === null || reviewTotal < 100) return false;
  return review30d >= prev30d * 1.20;
}
async function collectReviews() {
  console.log('📝 Steam 리뷰 수집 시작...');
  // KST 기준 오늘 날짜 (UTC+9)
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kst.toISOString().split('T')[0];
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
  const runId = await startPipelineRun('reviews');
  let saved = 0;
  let spikeCount = 0;
  for (const game of targets) {
    try {
      // API 호출 간격 1초 (Rate Limit 준수)
      await sleep(1000);
      const reviews = await retryWithBackoff(
        () => fetchReviews(game.app_id),
        { label: `reviews(${game.app_id})`, maxRetries: 2, baseMs: 2000 }
      );
      const spike = await calcReviewSpike(
        game.app_id, today,
        reviews.review30d,
        reviews.reviewTotal
      );
      if (spike) spikeCount++;
      // 스냅샷 업데이트
      await pool.query(`
        INSERT INTO game_snapshots
          (app_id, snapshot_date, review_total, review_positive,
           review_negative, review_30d, review_spike)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (app_id, snapshot_date) DO UPDATE SET
          review_total    = EXCLUDED.review_total,
          review_positive = EXCLUDED.review_positive,
          review_negative = EXCLUDED.review_negative,
          review_30d      = EXCLUDED.review_30d,
          review_spike    = EXCLUDED.review_spike,
          collected_at    = NOW()
      `, [
        game.app_id, today,
        reviews.reviewTotal,
        reviews.reviewPositive,
        reviews.reviewNegative,
        reviews.review30d,
        spike
      ]);
      const spikeTag = spike ? ' 🔥 리뷰급증!' : '';
      console.log(
        `  ✅ ${game.title}: ` +
        `총 ${reviews.reviewTotal.toLocaleString()}개 / ` +
        `30일 ${reviews.review30d}개${spikeTag}`
      );
      saved++;
    } catch (err) {
      console.warn(`  ⚠️ 실패 (${game.title}): ${err.message}`);
    }
  }
  await finishPipelineRun(runId, 'success', saved);
  console.log(`\n📊 결과: ${saved}개 저장 / 리뷰급증 ${spikeCount}개 감지`);
  return { saved, spikeCount };
}
module.exports = { collectReviews, fetchReviews, calcReviewSpike };
// 직접 실행 시
if (require.main === module) {
  collectReviews()
    .then(result => {
      console.log('\n🎉 리뷰 수집 완료!');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ 실패:', err.message);
      process.exit(1);
    });
}
