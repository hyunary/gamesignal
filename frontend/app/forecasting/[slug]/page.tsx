import { getForecastBySlug, ForecastThread } from '../../lib/queries';
import TerminalShell from '../../components/TerminalShell';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Markdown from '../../components/Markdown';

export const revalidate = 0;

const MILESTONE_CONFIG: Record<string, { icon: string; accent: string }> = {
  initial:         { icon: '📋', accent: 'var(--accent)' },
  wishlist_signal: { icon: '⭐', accent: 'var(--p1)' },
  metacritic:      { icon: '🎯', accent: 'var(--nc-blue)' },
  launch_week:     { icon: '🚀', accent: 'var(--pos)' },
  launch_month:    { icon: '📊', accent: 'var(--p2)' },
  update:          { icon: '🔄', accent: 'var(--line-strong)' },
};

export default async function ForecastDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getForecastBySlug(params.slug).catch(() => null);
  if (!data) notFound();

  const { forecast, threads } = data;

  const bearValue  = forecast.bear_min ? `${forecast.bear_min}만~` : '—';
  const baseValue  = forecast.base_min && forecast.base_max ? `${forecast.base_min}~${forecast.base_max}만` : '—';
  const bullValue  = forecast.bull_max ? `${forecast.bull_max}만+` : '—';

  return (
    <TerminalShell activeTab="forecasting">
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 24px' }}>

        {/* ── Back link ──────────────────────────────────── */}
        <Link href="/forecasting" style={{
          fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
          marginBottom: 20, transition: 'color .15s',
        }}>
          ← Forecasting
        </Link>

        {/* ── 2-column layout ─────────────────────────────── */}
        <div className="nc-fc-detail-layout">

          {/* ── Main column ──────────────────────────────── */}
          <div style={{ minWidth: 0 }}>

            {/* Game header card */}
            <div style={{
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              borderRadius: 'var(--r)', padding: '20px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h1 style={{ fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 4, letterSpacing: '-0.01em' }}>
                    {forecast.game_title}
                  </h1>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {forecast.developer && (
                      <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                        {forecast.developer}
                      </span>
                    )}
                    {forecast.platform && (
                      <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                        · {forecast.platform}
                      </span>
                    )}
                    {forecast.release_date && (
                      <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                        · {forecast.release_date}
                      </span>
                    )}
                  </div>
                  {forecast.summary && (
                    <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 10, lineHeight: 1.65 }}>
                      {forecast.summary}
                    </p>
                  )}
                </div>
                {forecast.app_id && (
                  <a
                    href={`https://store.steampowered.com/app/${forecast.app_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0, fontFamily: 'var(--t-mono)', fontSize: 11,
                      color: 'var(--accent)', textDecoration: 'none',
                      padding: '4px 10px', border: '1px solid var(--accent)',
                      borderRadius: 'var(--r)',
                    }}>
                    Steam ↗
                  </a>
                )}
              </div>

              {/* 예측 범위 */}
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
                <div style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--p1)',
                  letterSpacing: '.1em', marginBottom: 12,
                }}>
                  YEAR 1 SALES FORECAST
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { label: 'Bear', value: bearValue,  color: 'var(--ink)',   bg: 'var(--bg-elev)',    border: 'var(--line)' },
                    { label: 'Base', value: baseValue,  color: 'var(--accent)', bg: 'var(--accent-soft)', border: 'var(--line)' },
                    { label: 'Bull', value: bullValue,  color: 'var(--ink)',   bg: 'var(--bg-elev)',    border: 'var(--line)' },
                  ].map(s => (
                    <div key={s.label} style={{
                      background: s.bg, border: `1px solid ${s.border}`,
                      borderRadius: 'var(--r)', padding: '12px', textAlign: 'center',
                    }}>
                      <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '.1em', marginBottom: 6 }}>
                        {s.label}
                      </div>
                      <div style={{ fontFamily: 'var(--t-mono)', fontSize: 18, fontWeight: 600, color: s.color }}>
                        {s.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Thread timeline ─────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Analysis Journal</span>
              <span style={{
                fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
                background: 'var(--bg-sunken)', padding: '2px 7px', borderRadius: 0,
              }}>
                {threads.length} updates
              </span>
            </div>

            {threads.length === 0 ? (
              <div style={{
                padding: '40px 24px', textAlign: 'center',
                background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 'var(--r)',
              }}>
                <p style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-4)' }}>
                  NO UPDATES YET
                </p>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {/* 타임라인 선 */}
                <div style={{
                  position: 'absolute', left: 19, top: 0, bottom: 0,
                  width: 1, background: 'var(--line)',
                }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {threads.map(thread => (
                    <ThreadCard key={thread.id} thread={thread} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────── */}
          <aside style={{ position: 'sticky', top: 80 }}>

            {/* TOC */}
            {threads.length > 0 && (
              <div style={{
                background: 'var(--bg-elev)', border: '1px solid var(--line)',
                borderRadius: 'var(--r)', padding: '16px', marginBottom: 16,
              }}>
                <span style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600,
                  color: 'var(--ink-4)', letterSpacing: '.12em', display: 'block', marginBottom: 10,
                }}>
                  ANALYSIS JOURNAL
                </span>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {threads.map(t => {
                    const cfg = MILESTONE_CONFIG[t.milestone_type] || MILESTONE_CONFIG.update;
                    return (
                      <a
                        key={t.id}
                        href={`#thread-${t.id}`}
                        style={{
                          display: 'flex', alignItems: 'baseline', gap: 6,
                          fontSize: 12, color: 'var(--ink-3)', textDecoration: 'none',
                          padding: '3px 0', borderRadius: 'var(--r)',
                          transition: 'color .15s',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>{cfg.icon}</span>
                        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', flexShrink: 0 }}>
                          {t.thread_date}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }}>
                          {t.milestone_label}
                        </span>
                      </a>
                    );
                  })}
                </nav>
              </div>
            )}

            {/* 현재 예측 범위 */}
            <div style={{
              background: 'var(--bg-elev)', border: '1px solid var(--line)',
              borderRadius: 'var(--r)', padding: '16px',
            }}>
              <span style={{
                fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600,
                color: 'var(--ink-4)', letterSpacing: '.12em', display: 'block', marginBottom: 10,
              }}>
                FORECAST RANGE
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Bear', value: bearValue },
                  { label: 'Base', value: baseValue, highlight: true },
                  { label: 'Bull', value: bullValue },
                ].map(s => (
                  <div key={s.label} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', borderRadius: 'var(--r)',
                    background: s.highlight ? 'var(--accent-soft)' : 'transparent',
                  }}>
                    <span style={{
                      fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600,
                      letterSpacing: '.1em',
                      color: s.highlight ? 'var(--accent)' : 'var(--ink-4)',
                    }}>
                      {s.label.toUpperCase()}
                    </span>
                    <span style={{
                      fontFamily: 'var(--t-mono)', fontSize: 13, fontWeight: 600,
                      color: s.highlight ? 'var(--accent)' : 'var(--ink-2)',
                    }}>
                      {s.value}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{
                fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)',
                marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)',
              }}>
                YEAR 1 SALES · 만 장
              </div>
            </div>

          </aside>

        </div>
      </div>
    </TerminalShell>
  );
}

// ─── Thread Card ────────────────────────────────────────────────────────────

function ThreadCard({ thread }: { thread: ForecastThread }) {
  const cfg = MILESTONE_CONFIG[thread.milestone_type] || MILESTONE_CONFIG.update;
  const hasUpdatedRange = thread.updated_base_min && thread.updated_base_max;

  return (
    <div id={`thread-${thread.id}`} style={{ position: 'relative', paddingLeft: 52 }}>
      {/* 아이콘 */}
      <div style={{
        position: 'absolute', left: 0,
        width: 38, height: 38, borderRadius: '50%',
        background: 'var(--bg-elev)', border: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, zIndex: 1,
      }}>
        {cfg.icon}
      </div>

      {/* Card body */}
      <div style={{
        background: 'var(--bg-elev)', border: '1px solid var(--line)',
        borderLeft: `3px solid ${cfg.accent}`,
        borderRadius: 0,
        padding: '14px 16px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div>
            <span style={{
              fontFamily: 'var(--t-mono)', fontSize: 11, fontWeight: 600,
              color: 'var(--ink)', letterSpacing: '.04em',
            }}>
              {thread.milestone_label}
            </span>
            <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', marginLeft: 10 }}>
              {thread.thread_date}
            </span>
          </div>
          {hasUpdatedRange && (
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', marginBottom: 2 }}>
                수정 예측
              </div>
              <div style={{ fontFamily: 'var(--t-mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>
                {thread.updated_base_min}~{thread.updated_base_max}만
              </div>
            </div>
          )}
        </div>

        {/* Content — markdown */}
        <Markdown>{thread.content}</Markdown>
      </div>
    </div>
  );
}
