const pool = require('../db/pool');
// False Positive 억제 필터 체인
// 신호 조건을 충족해도 이 필터를 통과해야 signals 테이블에 INSERT됨
async function shouldSuppress(appId, signalType, ccu, today) {
  // 필터 1: 카테고리 제외 (adult/dlc/software)
  const { rows: gameRows } = await pool.query(
    'SELECT is_adult_only, is_dlc, is_software, release_date FROM games WHERE app_id = $1',
    [appId]
  );
  const game = gameRows[0];
  if (!game) return 'NO_GAME_DATA';
  if (game.is_adult_only) return 'CATEGORY_ADULT';
  if (game.is_dlc)        return 'CATEGORY_DLC';
  if (game.is_software)   return 'CATEGORY_SOFTWARE';
  // 필터 2: 신규 출시 14일 이내 (S1·S2만 적용)
  if (['new_entry_mp', 'traffic_revival'].includes(signalType)) {
    if (game.release_date) {
      const releaseDate = new Date(game.release_date);
      const todayDate   = new Date(today);
      const diffDays    = (todayDate - releaseDate) / (1000 * 60 * 60 * 24);
      if (diffDays <= 14) return 'LAUNCH_WINDOW';
    }
  }
  // 필터 3: 최소 CCU 300 미만 (S1·S2만 적용)
  if (['new_entry_mp', 'traffic_revival'].includes(signalType)) {
    if (ccu !== null && ccu < 300) return 'MIN_CCU_NOT_MET';
  }
  return null; // PASS
}
module.exports = { shouldSuppress };
