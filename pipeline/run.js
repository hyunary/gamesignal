const { runSignalEngine } = require('../src/signals/engine');
const { sendPipelineAlert } = require('../src/notifications/discord');

if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}

const { execSync } = require('child_process');

async function runStep(command, label) {
  try {
    console.log(`\n[${label}] 실행 중...`);
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    console.log(`[${label}] 완료 ✅`);
  } catch (err) {
    console.error(`[${label}] 실패:`, err.message);
    await sendPipelineAlert(label, err.message).catch(() => {});
  }
}

async function runPipeline() {
  const startTime = Date.now();

  // KST 기준 오늘 날짜
  const kstTime = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kstTime.toISOString().split('T')[0];

  console.log('\n🚀 GameSignal 파이프라인 시작');
  console.log(`📅 실행 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`);
  console.log(`📅 기준일: ${today}`);
  console.log('═'.repeat(50));

  // 전체 타임아웃 80분
  const timeout = setTimeout(async () => {
    console.error('⏰ 파이프라인 타임아웃 (80분 초과)');
    await sendPipelineAlert('pipeline', '80분 타임아웃 초과').catch(() => {});
    process.exit(1);
  }, 80 * 60 * 1000);

  try {
    // 1단계: Most Played
    await runStep('node src/collectors/mostPlayed.js', '1/5 Most Played');

    // 2단계: Wishlist
    await runStep('node src/collectors/wishlist.js', '2/5 Wishlist');

    // 3단계: 리뷰
    await runStep('node src/collectors/reviews.js', '3/5 리뷰');

    // 4단계: appdetails
    await runStep('node src/collectors/steamApi.js', '4/5 appdetails');

    // 5단계: 신호 엔진 (날짜 인자 제거 — 내부에서 KST 계산)
    console.log('\n[5/5] 신호 엔진 실행...');
    await runSignalEngine();

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n✅ 전체 파이프라인 완료 (${duration}초)`);

  } catch (err) {
    console.error('❌ 파이프라인 실패:', err.message);
    await sendPipelineAlert('pipeline', err.message).catch(() => {});
    process.exit(1);
  } finally {
    clearTimeout(timeout);
    process.exit(0);
  }
}

runPipeline();
