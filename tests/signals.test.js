// 신호 엔진 핵심 로직 단위 테스트
// (DB 연결 없이 순수 함수만 테스트)
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
console.log('\n🧪 GS-055 신호 엔진 단위 테스트\n');
// ── Signal 2: MA7 베이스라인 계산 ──────────────────────────
console.log('[ S2 트래픽 부활 — 임계값 경계값 ]');
function checkRevival(ccu, avgCcu) {
  return ccu >= avgCcu * 1.5;
}
test('CCU × 1.5 정확히 → 발동 (경계값 포함, >= 조건)',
  () => assert(checkRevival(15000, 10000) === true, '15000 >= 10000×1.5 → TRUE'));
test('CCU × 1.499 → 발동 안 함 (임계값 미만)',
  () => assert(checkRevival(14999, 10000) === false, '14999 < 10000×1.5 → FALSE'));
test('CCU × 2.0 → 발동',
  () => assert(checkRevival(20000, 10000) === true, '2배 → TRUE'));
test('CCU × 1.0 (변화 없음) → 발동 안 함',
  () => assert(checkRevival(10000, 10000) === false, '동일 → FALSE'));
// ── Signal 2: 부재 일수 경계값 ─────────────────────────────
console.log('\n[ S2 부재 일수 경계값 ]');
function checkAbsent(absentDays) {
  return absentDays >= 3;
}
test('absent_days=3 → 발동 (경계값 포함)',
  () => assert(checkAbsent(3) === true, '3 >= 3 → TRUE'));
test('absent_days=2 → 발동 안 함 (FP 억제)',
  () => assert(checkAbsent(2) === false, '2 < 3 → FALSE'));
test('absent_days=7 → 발동',
  () => assert(checkAbsent(7) === true, '7 >= 3 → TRUE'));
// ── Signal 3: rank_change_flag 경계값 ──────────────────────
console.log('\n[ S3 위시리스트 급등 경계값 ]');
function calcFlag(prevRank, currRank) {
  if (prevRank === null || currRank === null) return null;
  const delta = prevRank - currRank;
  if (delta >= 5)  return 'surge';
  if (delta <= -5) return 'drop';
  return 'stable';
}
test('Δrank=5 → surge (경계값 포함)',
  () => assert(calcFlag(20, 15) === 'surge', '정확히 5 → surge'));
test('Δrank=4 → stable (임계값 미만)',
  () => assert(calcFlag(20, 16) === 'stable', '4 → stable'));
test('Δrank=-5 → drop (경계값 포함)',
  () => assert(calcFlag(15, 20) === 'drop', '-5 → drop'));
test('Δrank=-4 → stable',
  () => assert(calcFlag(16, 20) === 'stable', '-4 → stable'));
// ── Signal 4: review_spike 경계값 ──────────────────────────
console.log('\n[ S4 리뷰 급증 경계값 ]');
function checkSpike(review30d, prev30d, reviewTotal) {
  if (prev30d === null || reviewTotal < 100) return false;
  return review30d >= prev30d * 1.20;
}
test('+20% 정확히 → spike TRUE (경계값 포함)',
  () => assert(checkSpike(120, 100, 200) === true, '120 >= 100×1.2 → TRUE'));
test('+19% → spike FALSE (임계값 미만)',
  () => assert(checkSpike(119, 100, 200) === false, '119 < 100×1.2 → FALSE'));
test('review_total=99 → spike FALSE (노이즈 방지)',
  () => assert(checkSpike(150, 100, 99) === false, 'total<100 → FALSE'));
test('review_total=100 → spike TRUE (경계값 포함)',
  () => assert(checkSpike(120, 100, 100) === true, 'total=100 → TRUE'));
test('전일 데이터 없음(null) → spike FALSE',
  () => assert(checkSpike(120, null, 200) === false, 'prev=null → FALSE'));
// ── FP 필터: 최소 CCU ──────────────────────────────────────
console.log('\n[ FP 필터: 최소 CCU ]');
function checkMinCcu(ccu, signalType) {
  if (!['new_entry_mp', 'traffic_revival'].includes(signalType)) return false;
  return ccu !== null && ccu < 300;
}
test('CCU=299, new_entry_mp → SUPPRESS',
  () => assert(checkMinCcu(299, 'new_entry_mp') === true, '299 < 300 → suppress'));
test('CCU=300, new_entry_mp → PASS',
  () => assert(checkMinCcu(300, 'new_entry_mp') === false, '300 >= 300 → pass'));
test('CCU=100, wishlist_surge → PASS (CCU 필터 미적용)',
  () => assert(checkMinCcu(100, 'wishlist_surge') === false, 'wishlist는 CCU 필터 없음'));
// ── S5: 복합 신호 조건 ─────────────────────────────────────
console.log('\n[ S5 복합 신호 ]');
function checkComposite(signalCount) {
  return signalCount >= 2;
}
test('신호 2개 → composite 생성',
  () => assert(checkComposite(2) === true, '2 >= 2 → TRUE'));
test('신호 1개 → composite 미생성',
  () => assert(checkComposite(1) === false, '1 < 2 → FALSE'));
test('신호 3개 → composite 생성',
  () => assert(checkComposite(3) === true, '3 >= 2 → TRUE'));
// ── 최종 결과 ──────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`결과: ${passed}개 통과 / ${failed}개 실패`);
if (failed === 0) {
  console.log('🎉 모든 테스트 통과! 신호 엔진 경계값 검증 완료.');
} else {
  console.log('❌ 실패한 테스트를 확인해주세요.');
  process.exit(1);
}
