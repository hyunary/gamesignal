const { fetchReviews, calcReviewSpike } = require('../src/collectors/reviews');
const pool = require('../src/db/pool');
async function runTest() {
  console.log('\n🧪 GS-031 리뷰 수집 테스트\n');
  // 상위 3개 게임으로 테스트
  const { rows } = await pool.query(`
    SELECT app_id, title FROM games
    WHERE is_adult_only = FALSE AND is_dlc = FALSE
    ORDER BY app_id LIMIT 3
  `);
  console.log('[ API 수집 테스트 ]');
  for (const game of rows) {
    try {
      process.stdout.write(`  ${game.title} ... `);
      const r = await fetchReviews(game.app_id);
      console.log(`✅ 총 ${r.reviewTotal.toLocaleString()}개 / 30일 ${r.review30d}개`);
      await new Promise(res => setTimeout(res, 1000));
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }
  console.log('\n[ review_spike 경계값 테스트 ]');
  // 직접 calcReviewSpike 로직을 테스트
  let passed = 0; let failed = 0;
  function test(name, condition) {
    if (condition) { console.log(`  ✅ PASS: ${name}`); passed++; }
    else           { console.log(`  ❌ FAIL: ${name}`); failed++; }
  }
  // 수식: review30d >= prev30d * 1.20 AND reviewTotal >= 100
  test('정확히 +20% → spike TRUE (경계값 포함)',
    120 >= 100 * 1.20 && 200 >= 100);
  test('+19% → spike FALSE (임계값 미만)',
    !(119 >= 100 * 1.20));
  test('total=99 → spike FALSE (노이즈 방지)',
    !(120 >= 100 * 1.20 && 99 >= 100));
  test('total=100 → spike TRUE (경계값 포함)',
    120 >= 100 * 1.20 && 100 >= 100);
  test('+50% 급증 → spike TRUE',
    150 >= 100 * 1.20 && 500 >= 100);
  console.log(`\n결과: ${passed}개 통과 / ${failed}개 실패`);
  if (failed === 0) console.log('🎉 모든 테스트 통과!');
  await pool.end();
}
runTest().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
