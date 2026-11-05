if (!process.env.DATABASE_URL) {
  require('dotenv').config();
}
const fs = require('fs');
const { spawnSync } = require('child_process');

const MIN = 60 * 1000;
const envMs = (name, fallback) => parseInt(process.env[name]) || fallback;
// 로그용 시간 표기 (1분 미만은 초 단위)
const fmt = (ms) => (ms >= MIN ? `${Math.round(ms / MIN)}분` : `${Math.round(ms / 1000)}초`);

/**
 * 수집 단계 정의
 * - timeoutMs: 단계별 프로세스 상한. 초과 시 SIGKILL → 다음 단계로 진행
 *   (예전 execSync는 이벤트 루프를 막아 전역 80분 타이머가 단계 중에 발동하지 못했고,
 *    리뷰 단계가 75분을 쓴 뒤 신호 엔진 시작 직후에 타이머가 터져 엔진이 중단됐다)
 * - source: pipeline_runs.source — kill된 단계의 'running' 행을 failed로 마감할 때 사용
 * 합계(15+8+17+17) + 엔진 15 = 72분 < workflow timeout-minutes(90)
 */
const STEPS = [
  { label: '1/5 Most Played', script: 'src/collectors/mostPlayed.js', source: 'most_played', timeoutMs: envMs('STEP_TIMEOUT_MOST_PLAYED_MS', 15 * MIN) },
  { label: '2/5 Wishlist',    script: 'src/collectors/wishlist.js',   source: 'wishlist',    timeoutMs: envMs('STEP_TIMEOUT_WISHLIST_MS', 8 * MIN) },
  // 리뷰 수집기 내부 상한(REVIEWS_BUDGET_MS 15분) + 마감 여유 2분
  { label: '3/5 리뷰',        script: 'src/collectors/reviews.js',    source: 'reviews',     timeoutMs: envMs('STEP_TIMEOUT_REVIEWS_MS', 17 * MIN) },
  { label: '4/5 appdetails',  script: 'src/collectors/steamApi.js',   source: 'appdetails',  timeoutMs: envMs('STEP_TIMEOUT_APPDETAILS_MS', 17 * MIN) },
];
const ENGINE_TIMEOUT_MS = envMs('STEP_TIMEOUT_SIGNAL_ENGINE_MS', 15 * MIN);

// KST 기준 오늘 날짜 (수집기들과 같은 계산)
function kstToday() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
}

/**
 * 수집 단계 1개 실행 (자식 프로세스, 단계별 timeout)
 * 실패/timeout이어도 throw하지 않고 결과만 반환 → 다음 단계와 신호 엔진은 항상 실행
 * deps: { alert(label, msg), failStaleRuns(date, sources, msg), today } — 테스트 주입용
 */
async function runStep(step, deps) {
  const started = Date.now();
  console.log(`\n[${step.label}] 실행 중... (상한 ${fmt(step.timeoutMs)})`);
  const r = spawnSync(process.execPath, [step.script], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
    timeout: step.timeoutMs,
    killSignal: 'SIGKILL',
  });
  const durationSec = Math.round((Date.now() - started) / 1000);

  let outcome = 'ok';
  let message = null;
  if (r.error && r.error.code === 'ETIMEDOUT') {
    outcome = 'timeout';
    message = `단계 상한 ${fmt(step.timeoutMs)} 초과로 강제 종료`;
  } else if (r.error) {
    outcome = 'failed';
    message = `실행 오류: ${r.error.message}`;
  } else if (r.status !== 0) {
    outcome = 'failed';
    message = r.signal ? `시그널 ${r.signal}로 종료` : `exit code ${r.status}`;
  }

  if (outcome === 'ok') {
    console.log(`[${step.label}] 완료 ✅ (${durationSec}초)`);
  } else {
    console.error(`[${step.label}] ${outcome === 'timeout' ? '⏰ 타임아웃' : '실패'} ❌ (${durationSec}초): ${message}`);
    // kill되면 수집기의 finally가 실행되지 못하므로 남은 'running' 행을 여기서 마감
    try {
      const n = await deps.failStaleRuns(deps.today, [step.source], `${step.label}: ${message}`);
      if (n > 0) console.error(`[${step.label}] pipeline_runs 'running' ${n}건 → failed 마감`);
    } catch (e) {
      console.error(`[${step.label}] pipeline_runs 마감 실패: ${e.message}`);
    }
    await deps.alert(step.label, message).catch(() => {});
  }
  return { label: step.label, source: step.source, outcome, durationSec, message };
}

// Promise에 상한 적용 (신호 엔진은 같은 프로세스에서 비동기로 돌아 타이머가 정상 동작)
function withTimeout(promise, ms, label) {
  let timer;
  const t = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} 상한 ${fmt(ms)} 초과`), { timedOut: true })), ms);
  });
  return Promise.race([promise, t]).finally(() => clearTimeout(timer));
}

// GitHub Actions 실행 요약 (Job Summary) — 오케스트레이터가 로그 없이 결과 확인
function writeStepSummary(today, results, totalSec) {
  const lines = [
    `## GameSignal 파이프라인 ${today}`,
    '',
    '| 단계 | 결과 | 소요(초) | 메모 |',
    '|---|---|---|---|',
    ...results.map((r) => `| ${r.label} | ${r.outcome === 'ok' ? '✅ ok' : r.outcome === 'timeout' ? '⏰ timeout' : '❌ failed'} | ${r.durationSec} | ${r.message ?? ''} |`),
    '',
    `총 ${totalSec}초`,
  ];
  console.log('\n' + lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) {
    try { fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n') + '\n'); } catch { /* 요약 실패는 무시 */ }
  }
}

async function runPipeline() {
  // 의존 모듈은 여기서 로드 (테스트에서 runStep만 import할 때 DB 연결 불필요)
  const { runSignalEngine } = require('../src/signals/engine');
  const { sendPipelineAlert } = require('../src/notifications/discord');
  const { failStaleRuns } = require('../src/db/queries');

  const startTime = Date.now();
  const today = kstToday();
  console.log('\n🚀 GameSignal 파이프라인 시작');
  console.log(`📅 실행 시각: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`);
  console.log(`📅 기준일: ${today}`);
  console.log('═'.repeat(50));

  const deps = { today, failStaleRuns, alert: sendPipelineAlert };
  const results = [];

  // 1~4단계: 수집 — 실패해도 다음 단계로
  for (const step of STEPS) {
    results.push(await runStep(step, deps));
  }

  // 5단계: 신호 엔진 — 수집 결과와 무관하게 반드시 실행
  console.log(`\n[5/5] 신호 엔진 실행... (상한 ${fmt(ENGINE_TIMEOUT_MS)})`);
  const engineStart = Date.now();
  const engine = { label: '5/5 신호 엔진', source: 'signal_engine', outcome: 'ok', durationSec: 0, message: null };
  try {
    const n = await withTimeout(runSignalEngine(), ENGINE_TIMEOUT_MS, '신호 엔진');
    engine.message = `신호 ${n}개`;
  } catch (err) {
    engine.outcome = err.timedOut ? 'timeout' : 'failed';
    engine.message = err.message;
    console.error(`❌ 신호 엔진 ${engine.outcome}: ${err.message}`);
    await failStaleRuns(today, ['signal_engine'], err.message).catch(() => {});
    await sendPipelineAlert('signal_engine', err.message).catch(() => {});
  }
  engine.durationSec = Math.round((Date.now() - engineStart) / 1000);
  results.push(engine);

  const totalSec = Math.round((Date.now() - startTime) / 1000);
  writeStepSummary(today, results, totalSec);

  // 한 단계라도 실패/timeout이면 exit 1 → workflow 실패 알림. (partial은 수집기가 exit 0)
  const anyFailed = results.some((r) => r.outcome !== 'ok');
  console.log(anyFailed ? `\n⚠️ 파이프라인 종료 — 실패 단계 있음 (${totalSec}초)` : `\n✅ 전체 파이프라인 완료 (${totalSec}초)`);
  return anyFailed ? 1 : 0;
}

module.exports = { runStep, withTimeout, fmt, STEPS };

if (require.main === module) {
  runPipeline()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error('❌ 파이프라인 오케스트레이터 오류:', err.message);
      process.exit(1);
    });
}
