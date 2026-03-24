const { sendPipelineSuccess } = require('../src/notifications/discord');
async function runTest() {
  console.log('\n🧪 Discord 알림 테스트\n');
  console.log('Discord 채널에 테스트 메시지를 보낼게요...');
  try {
    await sendPipelineSuccess({
      games: 100,
      signals: 5,
      duration: 47
    });
    console.log('✅ Discord 전송 성공!');
    console.log('👉 Discord gamesignal-alerts 채널을 확인해보세요!');
  } catch (err) {
    console.error('❌ 실패:', err.message);
  }
  process.exit(0);
}
runTest();
