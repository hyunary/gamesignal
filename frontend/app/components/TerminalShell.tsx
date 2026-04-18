import Link from 'next/link';
import { getPipelineStatus } from '../lib/queries';

const TABS = [
  { key: 'signals',     label: 'Signals',     href: '/' },
  { key: 'news',        label: 'News',        href: '/news' },
  { key: 'forecasting', label: 'Forecasting', href: '/forecasting' },
  { key: 'watchlist',   label: 'Watchlist',   href: '#', disabled: true },
  { key: 'publishers',  label: 'Publishers',  href: '#', disabled: true },
];

export default async function TerminalShell({
  children,
  activeTab,
}: {
  children: React.ReactNode;
  activeTab: string;
}) {
  const pipelineStatus = await getPipelineStatus().catch(() => []);
  const successCount = pipelineStatus.filter((p: any) => p.status === 'success').length;
  const totalCount = pipelineStatus.length;
  const pipeline = `${successCount}/${totalCount}`;

  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const timestamp = kstNow.toISOString().replace('T', ' ').slice(0, 16) + ' KST';

  return (
    <div className="gs-terminal" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Command bar ────────────────────────────────────── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 18,
        padding: '8px 24px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg-elev)',
        flexShrink: 0,
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 22, height: 22, background: 'var(--accent)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, borderRadius: 4,
          }}>◆</div>
          <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            GameSignal
          </span>
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)',
            letterSpacing: '.12em', borderLeft: '1px solid var(--line)', paddingLeft: 10, marginLeft: 2,
          }}>
            TERMINAL · v4.2
          </span>
        </div>

        {/* Search */}
        <div style={{
          flex: 1, maxWidth: 440, display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 6,
          background: 'var(--bg)', color: 'var(--ink-3)',
        }}>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5 L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--ink-4)' }}>
            Search games, publishers, signals…
          </span>
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)',
            border: '1px solid var(--line)', padding: '2px 5px', borderRadius: 3,
          }}>⌘K</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
            {timestamp}
          </span>
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--pos)',
            padding: '3px 8px', background: 'rgba(31,122,58,0.08)', borderRadius: 4, letterSpacing: '.06em',
          }}>
            PIPELINE {pipeline}
          </span>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', background: 'var(--ink)', color: '#fff',
            fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600,
          }}>GS</div>
        </div>
      </header>

      {/* ── Sub-nav tabs ───────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center',
        borderBottom: '1px solid var(--line)',
        padding: '0 24px', background: 'var(--bg-elev)', flexShrink: 0,
      }}>
        {TABS.map(t => (
          <Link
            key={t.key}
            href={(t as any).disabled ? '#' : t.href}
            style={{
              fontSize: 13, padding: '11px 13px',
              color: (t as any).disabled
                ? 'var(--ink-4)'
                : t.key === activeTab ? 'var(--ink)' : 'var(--ink-3)',
              borderBottom: t.key === activeTab ? '2px solid var(--ink)' : '2px solid transparent',
              fontWeight: t.key === activeTab ? 500 : 400,
              marginBottom: -1, display: 'inline-flex', alignItems: 'center',
              textDecoration: 'none', whiteSpace: 'nowrap',
              cursor: (t as any).disabled ? 'default' : 'pointer',
            }}>
            {t.label}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
      </nav>

      {/* ── Page content ───────────────────────────────────── */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* ── Status bar ─────────────────────────────────────── */}
      <footer style={{
        display: 'flex', alignItems: 'center', gap: 18,
        padding: '7px 24px', background: 'var(--bg-sunken)',
        borderTop: '1px solid var(--line)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          ● CONNECTED · steam.api
        </span>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          REGION KR
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          LAST UPDATE {timestamp}
        </span>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)' }}>v4.2.1</span>
      </footer>

    </div>
  );
}
