import { getAboutStats, getPipelineStatus } from '../lib/queries';
import { computePipelineInfo } from '../lib/pipeline';
import TerminalShell from '../components/TerminalShell';
import Link from 'next/link';

export const revalidate = 0;

const PRINCIPLES = [
  {
    tag: '01',
    title: 'Signals, not noise',
    body: '모든 Steam 데이터가 의미 있지는 않습니다. 우리는 실제 투자 판단에 쓸 수 있는 변화만 추출합니다.',
  },
  {
    tag: '02',
    title: 'Analyst perspective',
    body: 'VC·증권사 애널리스트 관점에서 뉴스와 트래픽 데이터를 해석합니다. 단순 집계가 아닌 맥락과 함의를 제공합니다.',
  },
  {
    tag: '03',
    title: 'Automated pipeline',
    body: '매일 KST 06:00 자동 수집·분석 파이프라인이 실행됩니다. 사람의 개입 없이 일관된 품질을 유지합니다.',
  },
];

const TIMELINE = [
  { year: '2026.05', label: 'PROTOTYPE', body: 'Steam 신호 감지 알고리즘 초기 버전 개발. GitHub Actions 기반 자동화 파이프라인 구축.' },
  { year: '2026.06', label: 'MVP',       body: '뉴스 클리핑·판매량 예측 기능 추가. Supabase Edge Function 연동. 서비스 런칭.' },
  { year: 'NOW',     label: 'PLATFORM',  body: '에디토리얼 UI 리뉴얼. 오케스트레이터 자동 예측 제안 시스템 도입.' },
];

const FAQS = [
  {
    q: '데이터는 얼마나 자주 업데이트되나요?',
    a: '매일 KST 06:00 GitHub Actions 파이프라인이 실행되어 Steam 트래픽, 뉴스, 예측 데이터를 자동으로 수집합니다.',
  },
  {
    q: '판매량 예측은 어떤 방식으로 계산하나요?',
    a: 'Game Sales Predictor v1.5 모델을 기반으로 장르, 개발사 이력, Steam 위시리스트 트래픽, 유사 게임 벤치마크를 종합하여 Bear/Base/Bull 3개 시나리오를 생성합니다.',
  },
  {
    q: 'P0/P1/P2 시그널 티어는 무엇을 의미하나요?',
    a: 'P0는 즉각적인 투자 주목이 필요한 고우선순위 시그널, P1은 중요 변화, P2는 모니터링 대상 변화입니다. 알고리즘이 변화의 크기와 속도를 기반으로 자동 분류합니다.',
  },
  {
    q: '인벤 뉴스 클리핑은 어떻게 작동하나요?',
    a: '매일 인벤(inven.co.kr)의 게임 업계 뉴스를 수집하고, Claude AI가 VC·애널리스트 관점의 코멘트와 관련 주식 티커를 자동으로 생성합니다.',
  },
];

const FLOW_STEPS = [
  { num: '01', label: 'TRAFFIC',    name: '트래픽',    detail: 'GitHub Actions · 매일 KST 06:00 자동 수집' },
  { num: '02', label: 'NEWS',       name: '뉴스',      detail: 'Inven scraper + Claude AI analysis' },
  { num: '03', label: 'CANDIDATES', name: '분석 후보', detail: '뉴스 → 예측 제안 자동 생성' },
  { num: '04', label: 'SCENARIOS',  name: '시나리오',  detail: 'Game Sales Predictor v1.5' },
];

export default async function AboutPage() {
  const [stats, pipelineRuns] = await Promise.all([
    getAboutStats().catch(() => null),
    getPipelineStatus().catch(() => []),
  ]);

  const pipelineInfo = computePipelineInfo(pipelineRuns);
  const pipelineStatusText =
    pipelineInfo.status === 'ok'    ? `● LIVE · ${pipelineInfo.lastRun}` :
    pipelineInfo.status === 'stale' ? `⚠ 지연 · ${pipelineInfo.lastRun}` :
                                      '— 상태 확인 불가';
  const pipelineStatusColor =
    pipelineInfo.status === 'ok'    ? 'var(--pos)'      :
    pipelineInfo.status === 'stale' ? 'var(--nc-amber)' :
                                      'var(--ink-3)';

  const statItems = [
    { value: stats ? `${stats.total_clips}+` : '—', label: 'NEWS CLIPS' },
    { value: stats ? `${stats.total_days}일`  : '—', label: 'CLIPPING DAYS' },
    { value: stats ? `${stats.total_forecasts}종` : '—', label: 'FORECASTS TO DATE' },
    { value: stats ? `${stats.total_threads}건` : '—', label: 'FORECAST UPDATES' },
  ];

  return (
    <TerminalShell activeTab="about">
      <div className="gs-page">

        {/* ── Hero + Note Cover ──────────────────────────────────── */}
        <header className="nc-about-hero" style={{ marginBottom: 64 }}>
          <div>
            <span className="gs-eyebrow">04 — ABOUT</span>
            <h1 style={{
              fontSize: 64, lineHeight: 0.95, letterSpacing: '-0.04em',
              fontWeight: 400, fontFamily: 'var(--nc-display)', margin: '0 0 24px',
            }}>
              Noise in. Signal out.
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.5, color: 'var(--ink-2)', maxWidth: 560 }}>
              Steam 트래픽 모니터링, 인벤 뉴스 클리핑, 게임 판매량 예측을 통합한
              투자·산업 분석 인텔리전스 대시보드입니다.
            </p>
          </div>

          {/* Note cover: rust card with brand text, -2deg on desktop */}
          <div className="nc-note-cover" style={{
            background: 'var(--accent)',
            color: 'var(--on-ink)',
            padding: '28px 24px',
            width: 220,
            flexShrink: 0,
          }}>
            <div style={{
              fontFamily: 'var(--t-mono)', fontSize: 9, letterSpacing: '.16em',
              textTransform: 'uppercase', marginBottom: 24, opacity: 0.65,
            }}>
              The Analyst&apos;s Notebook
            </div>
            <div style={{
              fontFamily: 'var(--nc-display)', fontSize: 26, lineHeight: 1.25,
              fontWeight: 400, fontStyle: 'italic',
            }}>
              Observe.<br />Connect.<br />Anticipate.
            </div>
          </div>
        </header>

        {/* ── Stats strip ─────────────────────────────────────────── */}
        <div className="nc-stats-strip" style={{ marginBottom: 72 }}>
          {statItems.map((s) => (
            <div key={s.label} style={{ padding: '28px 24px' }}>
              <div style={{
                fontSize: 40, fontWeight: 500, letterSpacing: '-0.03em',
                lineHeight: 1, fontVariantNumeric: 'tabular-nums',
              }}>
                {s.value}
              </div>
              <div style={{
                fontFamily: 'var(--t-mono)', fontSize: 10.5, color: 'var(--ink-3)',
                letterSpacing: '.14em', marginTop: 10, textTransform: 'uppercase',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <hr className="gs-heavy-rule" style={{ margin: '0 0 64px' }} />

        {/* ── Principles ──────────────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <span className="gs-section-label">PRINCIPLES</span>
          <h2 style={{
            fontSize: 36, letterSpacing: '-0.03em', fontWeight: 400,
            fontFamily: 'var(--nc-display)', margin: '4px 0 32px',
          }}>
            How we think about the problem.
          </h2>
          <div className="nc-principles-grid">
            {PRINCIPLES.map(p => (
              <article key={p.tag} style={{
                padding: '28px 26px',
                border: '1px solid var(--line)', borderRadius: 'var(--r)',
                background: 'var(--bg-elev)',
              }}>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--accent)',
                  fontWeight: 700, letterSpacing: '.14em', marginBottom: 16,
                }}>
                  {p.tag}
                </div>
                <h3 style={{ fontSize: 20, letterSpacing: '-0.02em', fontWeight: 500, margin: '0 0 10px' }}>
                  {p.title}
                </h3>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <hr className="gs-rule" style={{ margin: '0 0 72px' }} />

        {/* ── Timeline ────────────────────────────────────────────── */}
        <section className="nc-timeline-layout" style={{ marginBottom: 72 }}>
          <div>
            <span className="gs-section-label">TIMELINE</span>
            <h2 style={{
              fontSize: 36, letterSpacing: '-0.03em', fontWeight: 400,
              fontFamily: 'var(--nc-display)', margin: '4px 0 16px',
            }}>
              From prototype<br />to platform.
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)' }}>
              소수 엔지니어가 시작한 사이드 프로젝트에서 매일 업데이트되는 인텔리전스 플랫폼으로.
            </p>
          </div>
          <div>
            {TIMELINE.map((t, i) => (
              <div key={t.label} style={{
                display: 'grid', gridTemplateColumns: '120px 1fr', gap: 32,
                padding: '22px 0',
                borderBottom: i < TIMELINE.length - 1 ? '1px solid var(--line)' : 'none',
              }}>
                <div>
                  <div style={{
                    fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {t.year}
                  </div>
                  <div style={{
                    fontFamily: 'var(--t-mono)', fontSize: 10.5, color: 'var(--accent)',
                    letterSpacing: '.14em', marginTop: 4, fontWeight: 600,
                  }}>
                    {t.label}
                  </div>
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)', paddingTop: 4 }}>
                  {t.body}
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="gs-rule" style={{ margin: '0 0 72px' }} />

        {/* ── Data flow ───────────────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <span className="gs-section-label">PIPELINE</span>
          <h2 style={{
            fontSize: 36, letterSpacing: '-0.03em', fontWeight: 400,
            fontFamily: 'var(--nc-display)', margin: '4px 0 32px',
          }}>
            How the data flows.
          </h2>
          <div className="nc-flow-grid">
            {FLOW_STEPS.map(step => (
              <div key={step.num} style={{ background: 'var(--bg-elev)', padding: '20px 24px' }}>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)',
                  letterSpacing: '.12em', marginBottom: 8,
                }}>
                  {step.num} / {step.label}
                </div>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 12, fontWeight: 600, marginBottom: 6,
                }}>
                  {step.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  {step.detail}
                </div>
              </div>
            ))}
          </div>
        </section>

        <hr className="gs-rule" style={{ margin: '0 0 72px' }} />

        {/* ── FAQ accordion ───────────────────────────────────────── */}
        <section style={{ marginBottom: 72 }}>
          <span className="gs-section-label">FAQ</span>
          <h2 style={{
            fontSize: 36, letterSpacing: '-0.03em', fontWeight: 400,
            fontFamily: 'var(--nc-display)', margin: '4px 0 32px',
          }}>
            Frequently asked.
          </h2>
          <div className="nc-faq" style={{ maxWidth: 840 }}>
            {FAQS.map((f, i) => (
              <details key={i} style={{ borderTop: '1px solid var(--line)' }}>
                <summary style={{
                  fontSize: 18, fontWeight: 500, letterSpacing: '-0.012em', lineHeight: 1.4,
                  padding: '20px 4px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span>{f.q}</span>
                  <span className="nc-faq-icon" style={{
                    fontFamily: 'var(--t-mono)', fontSize: 18, color: 'var(--ink-4)', marginLeft: 16,
                  }}>+</span>
                </summary>
                <p style={{
                  fontSize: 15, lineHeight: 1.6, color: 'var(--ink-2)',
                  margin: '0 0 20px 4px', maxWidth: 680,
                }}>
                  {f.a}
                </p>
              </details>
            ))}
            <div style={{ borderTop: '1px solid var(--line)' }} />
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────── */}
        <section style={{
          padding: '56px 48px',
          border: '1px solid var(--ink)',
          borderRadius: 'var(--r)',
          background: 'var(--ink)',
          color: 'var(--on-ink)',
          marginBottom: stats ? 48 : 0,
        }}>
          <span className="gs-section-label" style={{ color: 'var(--on-ink)', opacity: 0.5 }}>
            GET STARTED
          </span>
          <h2 style={{
            fontSize: 40, letterSpacing: '-0.03em', fontWeight: 400,
            fontFamily: 'var(--nc-display)', margin: '6px 0 12px', lineHeight: 1.05,
            color: 'var(--on-ink)',
          }}>
            Want the signals, not the noise?
          </h2>
          <p style={{
            fontSize: 16, margin: '0 0 28px', maxWidth: 520, lineHeight: 1.5,
            color: 'var(--on-ink)', opacity: 0.8,
          }}>
            매일 아침 오늘의 핵심 시그널을 확인하세요.
            Steam 트래픽, 뉴스, 예측 — 한 곳에 통합됩니다.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/forecasting" style={{
              padding: '12px 22px',
              background: 'var(--on-ink)', color: 'var(--ink)',
              borderRadius: 'var(--r)', fontSize: 14, fontWeight: 500,
              textDecoration: 'none', display: 'inline-block',
            }}>
              Forecasting 보기 →
            </Link>
            <Link href="/dashboard" style={{
              padding: '12px 22px',
              border: '1px solid var(--on-ink)',
              borderRadius: 'var(--r)', fontSize: 14, fontWeight: 500,
              color: 'var(--on-ink)',
              textDecoration: 'none', display: 'inline-block',
            }}>
              Dashboard
            </Link>
          </div>
        </section>

        {/* ── System notes (collapsible) ────────────────────────────── */}
        {stats && (
          <details className="nc-system-details" style={{ marginTop: 48 }}>
            <summary style={{
              display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 12,
            }}>
              <span className="gs-section-label" style={{ marginBottom: 0, display: 'inline', cursor: 'pointer' }}>
                SYSTEM
              </span>
              <span className="nc-system-icon" style={{
                fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)',
              }}>
                ▸
              </span>
            </summary>
            <div style={{
              border: '1px solid var(--line)', borderRadius: 'var(--r)',
              background: 'var(--bg-elev)', overflow: 'hidden',
              fontFamily: 'var(--t-mono)', fontSize: 12,
            }}>
              {([
                { k: 'VERSION',          v: 'NoiseCatcher MVP v1.0',     vc: 'var(--ink)'     },
                { k: 'FRAMEWORK',        v: 'Next.js 14 + Tailwind CSS', vc: 'var(--ink)'     },
                { k: 'FORECAST_MODEL',   v: 'Game Sales Predictor v1.5', vc: 'var(--ink)'     },
                { k: 'LAST_CLIP_DATE',   v: stats.last_clip_date ?? '—', vc: 'var(--ink)'     },
                { k: 'Steam 파이프라인', v: pipelineStatusText,          vc: pipelineStatusColor },
              ] as { k: string; v: string; vc: string }[]).map((row, i, arr) => (
                <div key={row.k} style={{
                  display: 'flex', gap: 16, padding: '10px 18px',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <span style={{ color: 'var(--accent)', minWidth: 180, flexShrink: 0 }}>{row.k}</span>
                  <span style={{ color: row.vc }}>{row.v}</span>
                </div>
              ))}
            </div>
          </details>
        )}

      </div>
    </TerminalShell>
  );
}
