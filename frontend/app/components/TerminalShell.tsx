import { getPipelineStatus } from '@/app/lib/queries';
import { computePipelineInfo } from '@/app/lib/pipeline';
import NavBar from '@/app/components/shell/NavBar';
import Wordmark from '@/app/components/brand/Wordmark';

export default async function TerminalShell({
  children,
  activeTab,
}: {
  children: React.ReactNode;
  activeTab: string;
}) {
  const runs = await getPipelineStatus().catch(() => []);
  const pipelineInfo = computePipelineInfo(runs);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Skip link ─────────────────────────────────────────── */}
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>

      {/* ── Sticky nav ────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: 'var(--header-glass)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--line)',
      }}>
        <NavBar activeTab={activeTab} pipelineInfo={pipelineInfo} />
      </header>

      {/* ── Page content ──────────────────────────────────────── */}
      <main id="main-content" style={{ flex: 1 }}>
        {children}
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--line)',
        padding: '32px 40px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'var(--bg)',
      }}>
        <Wordmark href="/" />
        <span style={{
          fontFamily: 'var(--t-mono)', fontSize: 11,
          color: 'var(--ink-4)', letterSpacing: '.08em',
        }}>
          Noise in. Signal out.
        </span>
        <span style={{
          fontFamily: 'var(--t-mono)', fontSize: 11,
          color: 'var(--ink-4)', letterSpacing: '.08em',
        }}>
          © {new Date().getFullYear()} NoiseCatcher
        </span>
      </footer>

    </div>
  );
}
