import TerminalShell from '@/app/components/TerminalShell';
import Link from 'next/link';

export default function NotFound() {
  return (
    <TerminalShell activeTab="">
      <div className="gs-page" style={{ paddingTop: 80, textAlign: 'center' }}>
        <span className="gs-eyebrow">404</span>
        <h1 className="gs-h1" style={{ marginBottom: 24 }}>페이지를 찾을 수 없습니다.</h1>
        <Link
          href="/"
          style={{ fontFamily: 'var(--t-mono)', fontSize: 13, color: 'var(--accent)' }}
        >
          ← 홈으로 돌아가기
        </Link>
      </div>
    </TerminalShell>
  );
}
