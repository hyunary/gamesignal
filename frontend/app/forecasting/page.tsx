import { getAllForecasts, Forecast } from '../lib/queries';
import TerminalShell from '../components/TerminalShell';
import Link from 'next/link';

export const revalidate = 0;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: '분석 진행 중', color: 'var(--pos)',   bg: 'rgba(31,122,58,0.08)' },
  concluded: { label: '분석 완료',   color: 'var(--ink-3)', bg: 'var(--bg-sunken)' },
};

export default async function ForecastingPage() {
  const forecasts = await getAllForecasts().catch(() => []);

  return (
    <TerminalShell activeTab="forecasting">
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 24px' }}>

        {/* ── Panel header ─────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--line)',
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Sales Forecasting</span>
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
            background: 'var(--bg-sunken)', padding: '2px 7px', borderRadius: 999,
          }}>
            {forecasts.length} games
          </span>
          <div style={{ flex: 1 }} />
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em',
          }}>
            YEAR 1 SALES FORECAST
          </span>
        </div>

        {forecasts.length === 0 ? (
          <div style={{
            padding: '56px 24px', textAlign: 'center',
            background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 8,
          }}>
            <p style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-4)' }}>
              NO FORECASTS YET
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {forecasts.map(forecast => (
              <ForecastCard key={forecast.id} forecast={forecast} />
            ))}
          </div>
        )}

      </div>
    </TerminalShell>
  );
}

// ─── Forecast Card ──────────────────────────────────────────────────────────

function ForecastCard({ forecast }: { forecast: Forecast }) {
  const statusCfg = STATUS_CONFIG[forecast.status] || STATUS_CONFIG.active;

  return (
    <Link href={`/forecasting/${forecast.game_slug}`} className="gs-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>

        {/* 왼쪽: 게임 정보 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
            <span style={{
              fontFamily: 'var(--t-mono)', fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
              background: statusCfg.bg, color: statusCfg.color,
              padding: '3px 7px', borderRadius: 999,
            }}>
              {statusCfg.label}
            </span>
            {forecast.game_pass && (
              <span style={{
                fontFamily: 'var(--t-mono)', fontSize: 10,
                background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                padding: '3px 7px', borderRadius: 999,
              }}>
                Game Pass
              </span>
            )}
          </div>
          <h2 style={{
            fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {forecast.game_title}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
            <p style={{
              fontSize: 12, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5,
              overflow: 'hidden', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            } as React.CSSProperties}>
              {forecast.summary}
            </p>
          )}
        </div>

        {/* 오른쪽: 예측 범위 */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
            letterSpacing: '.1em', marginBottom: 6,
          }}>
            YEAR 1
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {[
              { k: 'Bull', v: forecast.bull_max ? `${forecast.bull_max}만+` : '—', c: 'var(--pos)' },
              { k: 'Base', v: forecast.base_min && forecast.base_max ? `${forecast.base_min}~${forecast.base_max}만` : '—', c: 'var(--accent)' },
              { k: 'Bear', v: forecast.bear_min ? `${forecast.bear_min}만~` : '—', c: 'var(--neg)' },
            ].map(s => (
              <div key={s.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)' }}>{s.k}</span>
                <span style={{ fontFamily: 'var(--t-mono)', fontSize: 13, fontWeight: 600, color: s.c }}>
                  {s.v}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </Link>
  );
}
