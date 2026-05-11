import Link from 'next/link';

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard',   href: '/dashboard' },
  { key: 'news',        label: 'News',        href: '/news' },
  { key: 'forecasting', label: 'Forecasting', href: '/forecasting' },
  { key: 'about',       label: 'About',       href: '/about' },
];

export default function TerminalShell({
  children,
  activeTab,
}: {
  children: React.ReactNode;
  activeTab: string;
}) {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const timeStr = kstNow.toISOString().split('T')[1].slice(0, 5);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Sticky Nav ───────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'rgba(250,250,247,0.88)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <div style={{
          maxWidth: 1320, margin: '0 auto', padding: '14px 40px',
          display: 'flex', alignItems: 'center', gap: 36,
        }}>

          {/* Brand */}
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: 'var(--accent)', flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              GameSignal
            </span>
          </Link>

          {/* Nav links */}
          <nav style={{ display: 'flex', gap: 28 }}>
            {NAV_ITEMS.map(item => (
              <Link
                key={item.key}
                href={item.href}
                style={{
                  fontSize: 13.5,
                  color: item.key === activeTab ? 'var(--ink)' : 'var(--ink-3)',
                  fontWeight: item.key === activeTab ? 500 : 400,
                  padding: '6px 0',
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Right — Live indicator + avatar */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{
              fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)',
              display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: '.02em',
            }}>
              <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
                <span style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'var(--pos)', animation: 'gspulse 1.8s ease-out infinite',
                }} />
                <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: 'var(--pos)' }} />
              </span>
              Live · {timeStr} KST
            </span>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: 'var(--ink)', color: '#fff',
              fontSize: 10.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              GS
            </div>
          </div>

        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────── */}
      <main style={{ flex: 1 }}>
        {children}
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--line)',
        padding: '24px 40px',
        display: 'flex', justifyContent: 'center',
        background: 'var(--bg)',
      }}>
        <span style={{
          fontFamily: 'var(--t-mono)', fontSize: 11,
          color: 'var(--ink-4)', letterSpacing: '.14em',
        }}>
          GAMESIGNAL · EDITORIAL EDITION · © 2025
        </span>
      </footer>

    </div>
  );
}
