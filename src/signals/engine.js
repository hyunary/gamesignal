const pool = require('../db/pool');
const { detectNewEntry }      = require('./signal1');
const { detectTrafficRevival } = require('./signal2');
const { detectWishlistSurge } = require('./signal3');
const { detectReviewSpike }   = require('./signal4');
const { detectComposite }     = require('./signal5');
const { startPipelineRun, finishPipelineRun, getRunStatus } = require('../db/queries');
const { sendSignalAlert, sendPipelineSuccess, sendPipelineAlert } = require('../notifications/discord');
const { analyzeGameSentiment } = require('../collectors/youtubeSentiment');
async function runSignalEngine(date) {
  // KST 기준 오늘 날짜 (UTC+9)
  const now = new Date();
  const kstOffset = 9 * 60; // KST = UTC+9
  const kstTime = new Date(now.getTime() + kstOffset * 60 * 1000);
  const today = kstTime.toISOString().split('T')[0];
  console.log(`기준일: ${today} (실행 시각: ${new Date().toLocaleString('ko-KR', {timeZone: 'Asia/Seoul'})} KST)`);
  const runId = await startPipelineRun('signal_engine');
  let totalSignals = 0;
  try {
    // 당일 wishlist 단계가 failed면 위시리스트 기반 신호(S3, new_entry_wl)는 건너뜀
    // (11/11: SteamSpy가 엉뚱한 목록을 돌려줘 가짜 신호 49건 발송)
    const wishlistStatus = await getRunStatus(today, 'wishlist');
    const skipWishlist = wishlistStatus === 'failed';
    if (skipWishlist) {
      console.warn('⚠️ 당일 wishlist 단계 failed → S3(위시리스트 급등)·new_entry_wl 감지 건너뜀');
    }

    // S1 → S2 → S3 → S4 순서 실행 (S5는 반드시 마지막)
    totalSignals += await detectNewEntry(today, { skipWishlist });

    // Wishlist 신규 진입 게임 YouTube 감성 분석
    const { rows: wlNewEntries } = await pool.query(`
      SELECT DISTINCT s.app_id, g.title
      FROM signals s
      JOIN games g USING(app_id)
      WHERE s.signal_date = $1
        AND s.signal_type = 'new_entry_wl'
    `, [today]);

    if (wlNewEntries.length > 0) {
      console.log(`\n🎬 YouTube 감성 분석 시작 (${wlNewEntries.length}개 게임)...`);
      for (const game of wlNewEntries) {
        try {
          await analyzeGameSentiment(game.app_id, game.title);
        } catch (err) {
          // 감성 분석은 부가 정보 — 실패해도 신호 감지는 계속
          console.warn(`  ⚠️ YouTube 감성 분석 실패 (${game.title}): ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 2000)); // API 호출 간격
      }
    }

    totalSignals += await detectTrafficRevival(today);
    if (skipWishlist) {
      console.log('  [S3] 건너뜀 (당일 wishlist failed)');
    } else {
      totalSignals += await detectWishlistSurge(today);
    }
    totalSignals += await detectReviewSpike(today);
    // S5: 복합 신호 (S1~S4 완료 후 실행)
    totalSignals += await detectComposite(today);
    await finishPipelineRun(runId, 'success', totalSignals);
  } catch (err) {
    // 신호 감지 자체가 실패한 경우만 failed
    await finishPipelineRun(runId, 'failed', totalSignals, err.message).catch((e) =>
      console.error(`⚠️ pipeline_runs[signal_engine] 마감 기록 실패: ${e.message}`));
    throw err;
  }

  // ── 알림·요약 단계: 실패해도 신호 기록(success)은 유지, 로그와 경고만 남김 ──
  try {
    // Discord 신호 알림 발송 (P0 우선, 미발송 신호만)
    const { rows: unnotified } = await pool.query(`
      SELECT
        s.signal_id, s.app_id, s.signal_type, s.priority,
        s.payload, s.signal_date, s.notified_at,
        g.title, g.genres, g.header_image_url
      FROM signals s
      JOIN games g USING(app_id)
      WHERE s.signal_date = $1
        AND s.notified_at IS NULL
        AND s.signal_type != 'composite'
      ORDER BY
        CASE s.priority WHEN 'P0' THEN 0 ELSE 1 END,
        s.created_at
    `, [today]);
    if (unnotified.length > 0) {
      console.log(`\n📨 Discord 알림 발송 중 (${unnotified.length}개)...`);
      for (const signal of unnotified) {
        try {
          await Promise.race([
            sendSignalAlert(signal, {
              title: signal.title,
              genres: signal.genres,
              header_image_url: signal.header_image_url
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Discord 타임아웃')), 5000))
          ]);
          console.log(`  ✅ 발송: [${signal.priority}] ${signal.signal_type} — ${signal.title}`);
          // 알림 간격 1초 (Discord Rate Limit 방지)
          await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
          console.error(`  ❌ 발송 실패 (${signal.title}): ${err.message}`);
        }
      }
    }
    // 파이프라인 완료 알림
    const startTime = new Date(
      (await pool.query(
        "SELECT started_at FROM pipeline_runs WHERE run_date = $1 AND source = 'signal_engine'",
        [today]
      )).rows[0]?.started_at
    );
    const duration = Math.round((Date.now() - startTime.getTime()) / 1000);
    await sendPipelineSuccess({
      games: (await pool.query(
        'SELECT COUNT(DISTINCT app_id) FROM game_snapshots WHERE snapshot_date = $1',
        [today]
      )).rows[0].count,
      signals: totalSignals,
      duration
    }).catch((err) => console.error(`  ❌ 파이프라인 완료 알림 실패: ${err.message}`));
    // 결과 요약
    console.log('\n' + '═'.repeat(50));
    console.log(`✅ 신호 엔진 완료 — 총 ${totalSignals}개 신호 생성`);
    console.log('═'.repeat(50));
    // 오늘 생성된 신호 목록 출력
    const { rows } = await pool.query(`
      SELECT
        s.signal_type as 신호,
        s.priority as 등급,
        g.title as 게임명,
        s.payload
      FROM signals s
      JOIN games g USING(app_id)
      WHERE s.signal_date = $1
      ORDER BY
        CASE s.priority WHEN 'P0' THEN 0 ELSE 1 END,
        s.created_at
    `, [today]);
    if (rows.length > 0) {
      console.log('\n📊 오늘의 신호:');
      rows.forEach(r => {
        console.log(`  [${r.등급}] ${r.신호.padEnd(15)} ${r.게임명}`);
      });
    } else {
      console.log('\n📊 오늘 감지된 신호 없음');
      console.log('   (데이터가 2일 이상 쌓이면 신호가 감지됩니다)');
    }
  } catch (err) {
    console.error(`⚠️ 신호 알림/요약 단계 오류 (신호 ${totalSignals}개는 저장됨): ${err.message}`);
    await sendPipelineAlert('signal_engine(알림)', err.message).catch(() => {});
  }
  return totalSignals;
}
module.exports = { runSignalEngine };
// 직접 실행 시
if (require.main === module) {
  runSignalEngine()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ 신호 엔진 실패:', err.message);
      process.exit(1);
    });
}
