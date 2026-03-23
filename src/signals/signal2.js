const pool = require('../db/pool');
const { shouldSuppress } = require('./filters');
const { emitSignal } = require('./emit');
async function detectTrafficRevival(today) {
  console.log('  [S2] 트래픽 부활 감지 중...');
  // 오늘 Most Played 진입 게임 중 부활 후보 조회
  const { rows } = await pool.query(`
    SELECT
      s.app_id, g.title,
      s.most_played_rank, s.concurrent_users
    FROM game_snapshots s
    JOIN games g USING(app_id)
    WHERE s.snapshot_date = $1
      AND s.most_played_rank IS NOT NULL
      AND s.is_new_entry_mp = FALSE
  `, [today]);
  let emitted = 0;
  for (const row of rows) {
    // 직전 7일 중 부재 일수 계산
    const { rows: absentRows } = await pool.query(`
      SELECT COUNT(*) as absent_days
      FROM generate_series(
        $2::date - 7, $2::date - 1, '1 day'::interval
      ) AS d(dt)
      LEFT JOIN game_snapshots s
        ON s.app_id = $1
        AND s.snapshot_date = d.dt::date
        AND s.most_played_rank IS NOT NULL
      WHERE s.app_id IS NULL
    `, [row.app_id, today]);
    const absentDays = parseInt(absentRows[0].absent_days);
    if (absentDays < 3) continue; // 3일 이상 부재여야 함
    // MA7 베이스라인 계산 (유효 스냅샷 3일 이상 필요)
    const { rows: baseRows } = await pool.query(`
      SELECT
        AVG(concurrent_users) as avg_ccu,
        COUNT(*) as valid_days,
        STDDEV(concurrent_users) as stddev_ccu
      FROM game_snapshots
      WHERE app_id = $1
        AND snapshot_date BETWEEN $2::date - 7 AND $2::date - 1
        AND concurrent_users IS NOT NULL
        AND most_played_rank IS NOT NULL
    `, [row.app_id, today]);
    const base = baseRows[0];
    if (!base.avg_ccu || parseInt(base.valid_days) < 3) continue;
    const avgCcu    = parseFloat(base.avg_ccu);
    const stddevCcu = parseFloat(base.stddev_ccu) || 0;
    const ccu       = row.concurrent_users;
    // 3σ 초과 → 봇 의심 QUARANTINE
    if (ccu > avgCcu + 3 * stddevCcu && stddevCcu > 0) {
      console.log(`    QUARANTINE(3σ): ${row.title}`);
      continue;
    }
    // CCU >= 7일 평균 × 1.5 (경계값 포함)
    if (ccu < avgCcu * 1.5) continue;
    const suppress = await shouldSuppress(row.app_id, 'traffic_revival', ccu, today);
    if (suppress) {
      console.log(`    SUPPRESS(${suppress}): ${row.title}`);
      continue;
    }
    const ccu_pct = ((ccu / avgCcu - 1) * 100).toFixed(1);
    const ok = await emitSignal(row.app_id, today, 'traffic_revival', 'P0', {
      absent_days: absentDays,
      ccu_pct: parseFloat(ccu_pct),
      concurrent_users: ccu,
      baseline_ccu: Math.round(avgCcu)
    });
    if (ok) {
      console.log(`    ✅ traffic_revival: ${row.title} (${absentDays}일 부재 → +${ccu_pct}%)`);
      emitted++;
    }
  }
  console.log(`  [S2] 완료: ${emitted}개 신호 생성`);
  return emitted;
}
module.exports = { detectTrafficRevival };
