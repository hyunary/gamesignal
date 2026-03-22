// rank_change_flag 계산 함수 (wishlist.js와 동일 로직)
function calcRankChangeFlag(prevRank, currRank) {
  if (prevRank === null || currRank === null) return null;
  const delta = prevRank - currRank;
  if (delta >= 5)  return 'surge';
  if (delta <= -5) return 'drop';
  return 'stable';
}
// 신규 진입 판별
function isNewEntry(prevRank) {
  return prevRank === null;
}
// 테스트 러너
let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`         → ${err.message}`);
    failed++;
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message || '조건 불충족');
}
console.log('\n🧪 GS-021 Wishlist 단위 테스트\n');
// 1. 신규 진입 감지
console.log('[ 신규 진입 감지 ]');
test('전일 없음 → 신규 진입 TRUE', () => {
  assert(isNewEntry(null) === true, '신규 진입이어야 함');
});
test('전일 있음 → 신규 진입 FALSE', () => {
  assert(isNewEntry(10) === false, '신규 진입 아님');
});
// 2. rank_change_flag 경계값 (★ 핵심)
console.log('\n[ rank_change_flag 경계값 ]');
test('Δrank=6 → surge', () => {
  assert(calcRankChangeFlag(20, 14) === 'surge', 'surge여야 함');
});
test('Δrank=5 → surge (경계값 포함, >= 조건)', () => {
  assert(calcRankChangeFlag(20, 15) === 'surge', '정확히 5도 surge (off-by-one 주의!)');
});
test('Δrank=4 → stable (임계값 미만)', () => {
  assert(calcRankChangeFlag(20, 16) === 'stable', '4는 stable');
});
test('Δrank=0 → stable (변동 없음)', () => {
  assert(calcRankChangeFlag(10, 10) === 'stable', '변동 없으면 stable');
});
test('Δrank=-5 → drop (경계값 포함)', () => {
  assert(calcRankChangeFlag(15, 20) === 'drop', '정확히 -5도 drop');
});
test('Δrank=-4 → stable', () => {
  assert(calcRankChangeFlag(16, 20) === 'stable', '-4는 stable');
});
test('전일 null → null (첫날 데이터)', () => {
  assert(calcRankChangeFlag(null, 10) === null, 'null이어야 함');
});
test('당일 null → null', () => {
  assert(calcRankChangeFlag(10, null) === null, 'null이어야 함');
});
// 최종 결과
console.log(`\n${'─'.repeat(40)}`);
console.log(`결과: ${passed}개 통과 / ${failed}개 실패`);
if (failed === 0) {
  console.log('🎉 모든 테스트 통과!');
} else {
  process.exit(1);
}
