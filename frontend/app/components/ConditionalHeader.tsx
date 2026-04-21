'use client';

import { usePathname } from 'next/navigation';

// TerminalShell을 사용하는 페이지에서는 글로벌 Header 숨김
const TERMINAL_PATHS = ['/', '/news', '/forecasting', '/about'];

export default function ConditionalHeader({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hide = TERMINAL_PATHS.includes(pathname) || pathname.startsWith('/forecasting/');
  if (hide) return null;
  return <>{children}</>;
}
