const axios = require('axios');
const pool = require('../db/pool');
const { startPipelineRun, finishPipelineRun } = require('../db/queries');
const { retryWithBackoff } = require('../utils/retry');
const { fallbackToPreviousDay } = require('../utils/fallback');
const { sleep } = require('../utils/sleep');
require('dotenv').config();

// Steam 리뷰 수집 (전체 누적 집계만)
// 참고: "최근 30일" 추세는 더 이상 API 2차 호출로 받지 않는다.
// query_summary.total_reviews는 filter/day_range와 무관하게 항상 전체 누적을
// 반환하므로(30일 집계 불가), 리뷰 급증은 signal4.js가 매일의 review_total
// 누적 차분(당일 증분)으로 계산한다.
async function fetchReviews(appId) {
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

  const s = allData.query_summary;
  return {
    appId,
    reviewTotal:    s.total_reviews  ?? 0,
    reviewPositive: s.total_positive ?? 0,
    reviewNegative: s.total_negative ?? 0,
  };
}

async function collectReviews() {
  console.log('\ud83d\udcdd Steam \ub9ac\ubdf0 \uc218\uc9d1 \uc2dc\uc791...');

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

  console.log(`\ud83d\udccb \uc218\uc9d1 \ub300\uc0c1: ${targets.length}\uac1c \uac8c\uc784`);
  const runId = await startPipelineRun('reviews');

  let saved = 0;
  for (const game of targets) {
    try {
      // API 호출 간격 1초 (Rate Limit 준수)
      await sleep(1000);
      const reviews = await retryWithBackoff(
        () => fetchReviews(game.app_id),
        { label: `reviews(${game.app_id})`, maxRetries: 2, baseMs: 2000 }
      );

      // 스냅샷 업데이트 (전체 누적만 저장 — 급증 판정은 signal4.js)
      await pool.query(`
        INSERT INTO game_snapshots
          (app_id, snapshot_date, review_total, review_positive, review_negative)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (app_id, snapshot_date) DO UPDATE SET
          review_total    = EXCLUDED.review_total,
          review_positive = EXCLUDED.review_positive,
          review_negative = EXCLUDED.review_negative,
          collected_at    = NOW()
      `, [
        game.app_id, today,
        reviews.reviewTotal,
        reviews.reviewPositive,
        reviews.reviewNegative,
      ]);

      console.log(
        `  \u2705 ${game.title}: ` +
        `\ucd1d ${reviews.reviewTotal.toLocaleString()}\uac1c ` +
        `(\uae0d\uc815 ${reviews.reviewPositive.toLocaleString()})`
      );
      saved++;
    } catch (err) {
      console.warn(`  \u26a0\ufe0f \uc2e4\ud328 (${game.title}): ${err.message}`);
    }
  }

  await finishPipelineRun(runId, 'success', saved);
  console.log(`\n\ud83d\udcca \uacb0\uacfc: ${saved}\uac1c \uc800\uc7a5`);
  return { saved };
}

module.exports = { collectReviews, fetchReviews };

// 직접 실행 시
if (require.main === module) {
  collectReviews()
    .then(() => {
      console.log('\n\ud83c\udf89 \ub9ac\ubdf0 \uc218\uc9d1 \uc644\ub8cc!');
      process.exit(0);
    })
    .catch(err => {
      console.error('\u274c \uc2e4\ud328:', err.message);
      process.exit(1);
    });
}
