const { fetchAppDetails, updateGameDetails } = require('../src/collectors/steamApi');
const pool = require('../src/db/pool');
async function runTest() {
  console.log('\n🧪 GS-030 Steam appdetails 테스트 (상위 5개)\n');
  // DB에서 상위 5개 앱ID 조회
  const { rows } = await pool.query(`
    SELECT app_id, title FROM games
    WHERE developer IS NULL
    ORDER BY app_id
    LIMIT 5
  `);
  console.log(`테스트 대상: ${rows.length}개\n`);
  for (const game of rows) {
    try {
      process.stdout.write(`  수집 중: ${game.title} ... `);
      const details = await fetchAppDetails(game.app_id);
      await updateGameDetails(details);
      console.log(`✅ (${details.developer ?? '개발사 없음'} / ${details.genres[0] ?? '장르 없음'})`);
      // 1초 대기
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }
  // 결과 확인
  console.log('\n📊 DB 저장 확인:');
  const { rows: result } = await pool.query(`
    SELECT title as 게임명, developer as 개발사,
           genres[1] as 장르, is_free_to_play as 무료,
           is_dlc as DLC
    FROM games
    WHERE developer IS NOT NULL
    LIMIT 5
  `);
  console.table(result);
  await pool.end();
  console.log('\n🎉 테스트 완료!');
}
runTest().catch(err => {
  console.error('❌ 테스트 실패:', err.message);
  process.exit(1);
});
