'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-6 text-xs uppercase tracking-widest">
      <Link
        href="/"
        className={`transition-colors pb-0.5 ${
          pathname === '/'
            ? 'text-cyan-400 border-b border-cyan-400'
            : 'text-gray-500 hover:text-cyan-400'
        }`}
      >
        Dashboard
      </Link>
      <Link
        href="/news"
        className={`transition-colors pb-0.5 ${
          pathname === '/news'
            ? 'text-cyan-400 border-b border-cyan-400'
            : 'text-gray-500 hover:text-cyan-400'
        }`}
      >
        News
      </Link>
    </nav>
  );
}
