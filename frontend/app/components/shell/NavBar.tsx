'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Wordmark from '@/app/components/brand/Wordmark';
import Monogram from '@/app/components/brand/Monogram';
import type { PipelineInfo } from '@/app/lib/pipeline';

export const NAV_ITEMS = [
  { key: 'forecasting', label: 'Forecasting', href: '/forecasting' },
  { key: 'news',        label: 'News',        href: '/news' },
  { key: 'dashboard',   label: 'Dashboard',   href: '/dashboard' },
  { key: 'about',       label: 'About',       href: '/about' },
];

interface Props {
  activeTab: string;
  pipelineInfo: PipelineInfo;
}

export default function NavBar({ activeTab, pipelineInfo }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Close on route change
  useEffect(() => { setIsOpen(false); }, [pathname]);

  // Close when viewport widens past the nav breakpoint
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 700) setIsOpen(false); };
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Escape key closes menu and returns focus to trigger
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        menuBtnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  const pipelineText =
    pipelineInfo.status === 'unavailable'
      ? '상태 확인 불가'
      : pipelineInfo.status === 'stale'
      ? `업데이트 지연 · 마지막 갱신 ${pipelineInfo.lastRun}`
      : `파이프라인 갱신 ${pipelineInfo.lastRun}`;

  return (
    <>
      {/* ── Header bar ─────────────────────────────────────── */}
      <div style={{
        maxWidth: 1320, margin: '0 auto', padding: '28px 40px',
        display: 'flex', alignItems: 'center', gap: 36,
      }}>

        {/* Brand — desktop (≥ 701px) */}
        <span className="hidden nav:inline">
          <Wordmark href="/" />
        </span>

        {/* Brand — mobile (< 701px) */}
        <Link
          href="/"
          aria-label="NoiseCatcher 홈"
          className="flex items-center nav:hidden"
          style={{ textDecoration: 'none' }}
        >
          <Monogram size={24} />
        </Link>

        {/* Nav links — desktop */}
        <nav
          className="hidden nav:flex items-center"
          style={{ gap: 28 }}
          aria-label="주 내비게이션"
        >
          {NAV_ITEMS.map(item => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={item.key === activeTab ? 'page' : undefined}
              style={{
                fontSize: 13.5,
                color: item.key === activeTab ? 'var(--accent)' : 'var(--ink-3)',
                fontWeight: item.key === activeTab ? 500 : 400,
                textDecoration: 'none',
                padding: '6px 0',
                borderBottom: item.key === activeTab
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Pipeline status — desktop */}
        <div
          className="hidden nav:flex items-center ml-auto"
          style={{ gap: 8 }}
        >
          {pipelineInfo.status !== 'unavailable' && (
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              flexShrink: 0, display: 'inline-block',
              background: pipelineInfo.status === 'ok'
                ? 'var(--nc-green)'
                : 'var(--nc-amber)',
            }} />
          )}
          <span style={{
            fontFamily: 'var(--t-mono)', fontSize: 11,
            color: 'var(--ink-3)', letterSpacing: '.02em',
          }}>
            {pipelineText}
          </span>
        </div>

        {/* Hamburger — mobile */}
        <button
          ref={menuBtnRef}
          id="mobile-menu-btn"
          aria-expanded={isOpen}
          aria-controls="mobile-nav-menu"
          aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
          onClick={() => setIsOpen(v => !v)}
          className="flex flex-col nav:hidden ml-auto"
          style={{
            gap: 5, padding: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--ink)',
          }}
        >
          <span style={{ display: 'block', width: 22, height: 1.5, background: 'currentColor' }} />
          <span style={{ display: 'block', width: 22, height: 1.5, background: 'currentColor' }} />
          <span style={{
            display: 'block', width: 22, height: 1.5, background: 'currentColor',
            opacity: isOpen ? 0 : 1, transition: 'opacity .15s',
          }} />
        </button>

      </div>

      {/* ── Mobile nav menu ─────────────────────────────────── */}
      <nav
        id="mobile-nav-menu"
        aria-label="모바일 내비게이션"
        hidden={!isOpen}
        style={{ borderTop: '1px solid var(--line)' }}
      >
        {NAV_ITEMS.map(item => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.key === activeTab ? 'page' : undefined}
            onClick={() => setIsOpen(false)}
            style={{
              display: 'block',
              padding: '14px 24px',
              fontSize: 15,
              fontWeight: item.key === activeTab ? 500 : 400,
              color: item.key === activeTab ? 'var(--accent)' : 'var(--ink)',
              textDecoration: 'none',
              borderLeft: item.key === activeTab
                ? '3px solid var(--accent)'
                : '3px solid transparent',
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
