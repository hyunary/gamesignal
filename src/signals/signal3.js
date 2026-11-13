const pool = require('../db/pool');
const { loadWishlistBaseline, shortDate } = require('../db/wishlistBaseline');
const { shouldSuppress } = require('./filters');
const { emitSignal } = require('./emit');
const { surgeLabel } = require('./format');

/**
 * S3: 위시리스트 급등 감지
 *
 * 이전 순위는 wishlist 수집기와 같은 기준일(최근 7일 중 위시리스트가 채워진 가장 최근 날)에서 읽는다.
 * (11/13: rank_change_flag는 기준일 11/10으로 계산됐는데 여기서는 오늘-1(11/12, 비어 있음)을 읽어
 *  "null위→7위, +null계단"으로 10건 발송됨)
 *
 * 기준일 간격이 2일 이상이면 S3를 건너뛴다.
 *  - rank_change_flag의 ±5계단은 하루 변동 기준이라 여러 날 누적 변동에 쓰면 급등이 과다 판정됨
 *    (11/13: 3일치 변동으로 10건, 평소 하루 0~5건)
 *  - 경계를 간격에 비례해 올리는 방식은 일별 변동이 선형으로 쌓인다는 가정이 필요하고 오탐 여지가 남음
 *  - new_entry_wl(S1)은 기준일 비교를 그대로 유지
 */
async function detectWishlistSurge(today) {
  console.log('  [S3] 위시리스트 급등 감지 중...');

  const baseline = await loadWishlistBaseline(today);
  if (!baseline) {
    console.log('  [S3] SKIP: 최근 7일 안에 기준 위시리스트 없음');
    return 0;
  }
  if (baseline.gapDays >= 2) {
    console.log(
      `  [S3] SKIP: 기준일 간격 ${baseline.gapDays}일 (기준 ${shortDate(baseline.date)}) — ` +
      '±5계단 급등 판정은 하루 변동 기준이라 여러 날 누적 변동에 적용하지 않음'
    );
    return 0;
  }

  const { rows } = await pool.query(`
    SELECT s.app_id, g.title, s.wishlist_rank
    FROM game_snapshots s
    JOIN games g USING(app_id)
    WHERE s.snapshot_date = $1
      AND s.rank_change_flag = 'surge'
  `, [today]);

  let emitted = 0;
  for (const row of rows) {
    const suppress = await shouldSuppress(row.app_id, 'wishlist_surge', null, today);
    if (suppress) {
      console.log(`    SUPPRESS(${suppress}): ${row.title}`);
      continue;
    }
    // 기준일 wishlist_rank 조회 (rank_change_flag 계산과 같은 기준)
    const { rows: prevRows } = await pool.query(`
      SELECT wishlist_rank FROM game_snapshots
      WHERE app_id = $1 AND snapshot_date = $2::date
    `, [row.app_id, baseline.date]);
    const prevRank = prevRows[0]?.wishlist_rank ?? null;
    if (prevRank === null) {
      // null 표기로 발송하지 않음
      console.log(`    SKIP(NO_PREV_RANK): ${row.title} — 기준일 ${shortDate(baseline.date)}에 위시리스트 순위 없음`);
      continue;
    }
    const payload = {
      curr_rank: row.wishlist_rank,
      prev_rank: prevRank,
      change: prevRank - row.wishlist_rank,
      baseline_date: baseline.date,
    };
    const ok = await emitSignal(row.app_id, today, 'wishlist_surge', 'P0', payload);
    if (ok) {
      console.log(`    ✅ wishlist_surge: ${row.title} (${surgeLabel(payload)})`);
      emitted++;
    }
  }
  console.log(`  [S3] 완료: ${emitted}개 신호 생성 (기준 ${shortDate(baseline.date)})`);
  return emitted;
}
module.exports = { detectWishlistSurge };
