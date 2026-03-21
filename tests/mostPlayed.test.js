const path = require('path');
const fs   = require('fs');
// ── 헬퍼: CCU 문자열 파싱 ──────────────────────────────────
function parseCCU(text) {
  return parseInt((text || '0').replace(/,/g, '').trim()) || 0;
}
// ── 헬퍼: 앱ID 추출 ───────────────────────────────────────
function extractAppId(href) {
  const m = (href || '').match(/\/app\/(\d+)/);
  return m ? parseInt(m[1]) : null;
}
// ── 헬퍼: 신규 진입 판별 ──────────────────────────────────
function isNewEntry(prevRank, currRank) {
  return prevRank === null && currRank !== null;
}
// ── 헬퍼: rank_change_flag 산정 ───────────────────────────
function calcRankChangeFlag(prevRank, currRank) {
  if (prevRank === null || currRank === null) return null;
  const delta = prevRank - currRank; // 양수 = 상승
  if (delta >= 5)  return 'surge';
  if (delta <= -5) return 'drop';
  return 'stable';
}
// ── 테스트 러너 ───────────────────────────────────────────
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
// ── 테스트 시작 ───────────────────────────────────────────
console.log('\n🧪 GS-013 Most Played 단위 테스트\n');
// 1. CCU 파싱 테스트
console.log('[ CCU 파싱 ]');
test('콤마 제거 후 숫자 변환', () => {
  assert(parseCCU('1,526,890') === 1526890, '1,526,890 파싱 실패');
});
test('콤마 없는 숫자', () => {
  assert(parseCCU('12345') === 12345, '12345 파싱 실패');
});
test('빈 문자열 → 0', () => {
  assert(parseCCU('') === 0, '빈 문자열은 0이어야 함');
});
test('null → 0', () => {
  assert(parseCCU(null) === 0, 'null은 0이어야 함');
});
// 2. 앱ID 추출 테스트
console.log('\n[ 앱ID 추출 ]');
test('정상 URL에서 앱ID 추출', () => {
  const id = extractAppId('https://store.steampowered.com/app/730/CounterStrike_2/');
  assert(id === 730, `730이어야 하는데 ${id}`);
});
test('앱ID 없는 URL → null', () => {
  assert(extractAppId('https://store.steampowered.com/') === null, 'null이어야 함');
});
test('null URL → null', () => {
  assert(extractAppId(null) === null, 'null이어야 함');
});
// 3. 신규 진입 감지 테스트 (GS-011 핵심 로직)
console.log('\n[ 신규 진입 감지 ]');
test('전일 없음 + 당일 진입 → TRUE (신규 진입)', () => {
  assert(isNewEntry(null, 5) === true, '신규 진입이어야 함');
});
test('전일 있음 + 당일 있음 → FALSE (유지)', () => {
  assert(isNewEntry(10, 8) === false, '신규 진입 아님');
});
test('전일 있음 + 당일 없음 → FALSE (이탈)', () => {
  assert(isNewEntry(10, null) === false, '이탈은 신규 진입 아님');
});
// 4. rank_change_flag 경계값 테스트 (★ 가장 중요)
console.log('\n[ rank_change_flag 경계값 — off-by-one 버그 방지 ]');
test('Δrank=6 → surge', () => {
  assert(calcRankChangeFlag(20, 14) === 'surge', 'surge여야 함');
});
test('Δrank=5 → surge (경계값 포함, >= 조건)', () => {
  assert(calcRankChangeFlag(20, 15) === 'surge', '정확히 5도 surge여야 함 (off-by-one 주의!)');
});
test('Δrank=4 → stable (임계값 미만)', () => {
  assert(calcRankChangeFlag(20, 16) === 'stable', '4는 stable이어야 함');
});
test('Δrank=-5 → drop (경계값 포함)', () => {
  assert(calcRankChangeFlag(15, 20) === 'drop', '정확히 -5도 drop이어야 함');
});
test('Δrank=-4 → stable', () => {
  assert(calcRankChangeFlag(16, 20) === 'stable', '-4는 stable이어야 함');
});
test('전일 null → null (베이스라인 없음)', () => {
  assert(calcRankChangeFlag(null, 10) === null, 'null이어야 함');
});
// 5. fixture HTML 파일 존재 확인
console.log('\n[ Fixture 파일 ]');
test('tests/fixtures/mostplayed.html 존재', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'mostplayed.html');
  assert(fs.existsSync(fixturePath), 'fixture 파일이 없음');
});
test('fixture HTML에 Steam 앱 링크 포함', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'mostplayed.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  assert(html.includes('/app/730/'), 'CS2 앱ID가 fixture에 없음');
});
// ── 최종 결과 ─────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`결과: ${passed}개 통과 / ${failed}개 실패`);
if (failed === 0) {
  console.log('🎉 모든 테스트 통과!');
} else {
  console.log('❌ 실패한 테스트를 확인해주세요.');
  process.exit(1);
}
