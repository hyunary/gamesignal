import { getAllForecasts, getForecastSuggestions, Forecast, ForecastSuggestion } from '../lib/queries';
import TerminalShell from '../components/TerminalShell';
import ForecastRequestBoard from '../components/ForecastRequestBoard';
import Link from 'next/link';

export const revalidate = 0;

export default async function ForecastingPage() {
  const [forecasts, suggestions] = await Promise.all([
    getAllForecasts().catch(() => []),
    getForecastSuggestions().catch(() => []),
  ]);

  const maxBull = Math.max(1, ...forecasts.map(f => f.bull_max ?? 0));

  return (
    <TerminalShell activeTab="forecasting">
      <div className="gs-page">

        {/* ── Page header ─────────────────────────────────────────── */}
        <header style={{ marginBottom: 40 }}>
          <span className="gs-eyebrow">03 — FORECAST</span>
          <h1 className="gs-h1">Upcoming releases, forecast.</h1>
          <p className="gs-deck">
            추적 중인 {forecasts.length}개 타이틀의 Year 1 판매량을 Bull / Base / Bear 시나리오로 분석합니다.
          </p>
        </header>

        {/* ── Orchestrator suggestions ────────────────────────────── */}
        {suggestions.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <span className="gs-section-label">ORCHESTRATOR SUGGESTIONS</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
              {suggestions.map((s: ForecastSuggestion) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px',
                  background: s.suggestion_type === 'new_forecast' ? 'var(--accent-soft)' : 'var(--p1-soft)',
                  border: `1px solid ${s.suggestion_type === 'new_forecast' ? 'var(--accent)' : 'var(--p1)'}`,
                  borderRadius: 8,
                }}>
                  <span style={{
                    fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600,
                    color: s.suggestion_type === 'new_forecast' ? 'var(--accent-ink)' : 'var(--p1)',
                    background: 'rgba(0,0,0,0.06)', padding: '2px 7px', borderRadius: 4, flexShrink: 0,
                    letterSpacing: '.08em',
                  }}>
                    {s.suggestion_type === 'new_forecast' ? 'NEW' : 'UPDATE'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{s.game_title}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{s.reason}</div>
                  </div>
                  <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10.5, color: 'var(--ink-4)' }}>
                    {new Date(s.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Forecast cards ──────────────────────────────────────── */}
        {forecasts.length === 0 ? (
          <div style={{
            padding: '56px 0', textAlign: 'center',
            border: '1px solid var(--line)', borderRadius: 10,
            background: 'var(--bg-elev)',
          }}>
            <p style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-4)', letterSpacing: '.1em' }}>
              NO FORECASTS YET
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: 20 }}>
            {forecasts.map(f => (
              <ForecastCard key={f.id} forecast={f} maxBull={maxBull} />
            ))}
          </div>
        )}

      <ForecastRequestBoard />
      </div>
    </TerminalShell>
  );
}

// ─── Forecast Card ───────────────────────────────────────────────────────────

function ForecastCard({ forecast: f, maxBull }: { forecast: Forecast; maxBull: number }) {
  const barPct = (v: number | null) => v ? Math.round((v / maxBull) * 100) : 0;

  const scenarios = [
    { key: 'bull', label: 'BULL', value: f.bull_max  ? `${f.bull_max}만+`  : '—', raw: f.bull_max,  color: 'var(--pos)', bg: 'transparent' },
    { key: 'base', label: 'BASE', value: f.base_min && f.base_max ? `${f.base_min}~${f.base_max}만` : '—', raw: f.base_max, color: 'var(--ink)', bg: 'var(--bg-sunken)' },
    { key: 'bear', label: 'BEAR', value: f.bear_min  ? `${f.bear_min}만~`  : '—', raw: f.bear_min,  color: 'var(--neg)', bg: 'transparent' },
  ];

  return (
    <Link href={`/forecasting/${f.game_slug}`} style={{ textDecoration: 'none', display: 'block' }} className="gs-card">
      <div style={{ padding: '24px 24px 0' }}>

        {/* Status + platform chips */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '.1em',
            padding: '4px 10px', borderRadius: 999,
            background: f.status === 'active' ? 'rgba(31,122,58,0.1)' : 'var(--bg-sunken)',
            color: f.status === 'active' ? 'var(--pos)' : 'var(--ink-3)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
            {f.status === 'active' ? 'ACTIVE' : 'CONCLUDED'}
          </span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {f.platform && (
              <span style={{ fontFamily: 'var(--t-mono)', fontSize: 9.5, padding: '3px 7px', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--ink-2)', letterSpacing: '.06em' }}>
                {f.platform.toUpperCase()}
              </span>
            )}
            {f.game_pass && (
              <span style={{ fontFamily: 'var(--t-mono)', fontSize: 9.5, padding: '3px 7px', borderRadius: 3, background: '#107C10', color: '#fff', letterSpacing: '.06em' }}>
                GAME PASS
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 26, lineHeight: 1.1, letterSpacing: '-0.025em', fontWeight: 500, margin: '0 0 6px', color: 'var(--ink)' }}>
          {f.game_title}
        </h2>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22, flexWrap: 'wrap', fontFamily: 'var(--t-mono)' }}>
          {f.developer && <span>{f.developer}</span>}
          {f.release_date && <><span style={{ color: 'var(--ink-4)' }}>·</span><span>{f.release_date}</span></>}
        </div>

        {/* Bull / Base / Bear block */}
        <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '4px 14px', marginBottom: 22, background: 'var(--bg)' }}>
          {scenarios.map(row => (
            <div key={row.key} style={{
              display: 'grid', gridTemplateColumns: '56px 120px 1fr',
              alignItems: 'center', gap: 14,
              padding: '10px 10px', borderRadius: 4, margin: '2px -8px',
              background: row.key === 'base' ? row.bg : 'transparent',
            }}>
              <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '.12em', color: row.color }}>
                {row.label}
              </span>
              <span style={{
                fontSize: 24, letterSpacing: '-0.025em', lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                color: row.color, fontWeight: row.key === 'base' ? 600 : 500,
              }}>
                {row.value}
              </span>
              <div style={{ height: 6, background: 'var(--bg-sunken)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: 2,
                  width: `${barPct(row.raw)}%`,
                  background: row.color,
                  opacity: row.key === 'base' ? 1 : 0.55,
                  transition: 'width .4s ease',
                }} />
              </div>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 8px 6px', borderTop: '1px solid var(--line)', marginTop: 4,
          }}>
            <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '.1em' }}>
              YEAR 1 SALES ESTIMATE
            </span>
            <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {f.genre || '—'}
            </span>
          </div>
        </div>

        {/* Summary */}
        {f.summary && (
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.55, margin: '0 0 16px' }}>
            {f.summary.length > 120 ? f.summary.slice(0, 120) + '…' : f.summary}
          </p>
        )}

      </div>

      {/* Footer link */}
      <div style={{
        marginTop: 4, padding: '12px 24px',
        borderTop: '1px solid var(--line)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 12.5, fontWeight: 500, color: 'var(--ink-3)',
      }}>
        <span>전체 분석 보기</span>
        <span>↓</span>
      </div>
    </Link>
  );
}
