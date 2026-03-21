const { retryWithBackoff } = require('../src/utils/retry');
async function runTests() {
  console.log('🧪 retry 로직 테스트 시작\n');
  // 테스트 1: 처음에 성공
  console.log('테스트 1: 첫 번째 시도에 성공하는 경우');
  const result1 = await retryWithBackoff(
    async () => '성공!',
    { label: 'test1', baseMs: 100 }
  );
  console.log(`  결과: ${result1 === '성공!' ? '✅ PASS' : '❌ FAIL'}\n`);
  // 테스트 2: 2번 실패 후 3번째 성공
  console.log('테스트 2: 2번 실패 후 성공하는 경우');
  let attempts2 = 0;
  const result2 = await retryWithBackoff(
    async () => {
      attempts2++;
      if (attempts2 < 3) throw new Error('일시적 에러');
      return '3번째 성공!';
    },
    { label: 'test2', baseMs: 100 }
  );
  console.log(`  결과: ${result2 === '3번째 성공!' ? '✅ PASS' : '❌ FAIL'}\n`);
  // 테스트 3: 계속 실패 → onFail 콜백 호출
  console.log('테스트 3: 계속 실패해서 폴백이 호출되는 경우');
  let fallbackCalled = false;
  try {
    await retryWithBackoff(
      async () => { throw new Error('계속 실패'); },
      {
        label: 'test3',
        baseMs: 100,
        maxRetries: 3,
        onFail: async () => { fallbackCalled = true; }
      }
    );
  } catch (e) {}
  console.log(`  결과: ${fallbackCalled ? '✅ PASS (폴백 호출됨)' : '❌ FAIL'}\n`);
  console.log('🎉 모든 테스트 완료!');
}
runTests().catch(console.error);
