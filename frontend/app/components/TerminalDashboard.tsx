'use client';

import { useState } from 'react';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Signal {
  signal_id: string;
  signal_type: string;
  priority: string;
  title: string;
  app_id: number;
  company_name: string | null;
  stock_ticker: string | null;
  is_listed: boolean | null;
  concurrent_users: number | null;
  most_played_rank: number | null;
  payload: any;
  header_image_url: string | null;
  is_first_ever_entry_mp: boolean | null;
  last_entry_date: string | null;
  signal_date: string;
}

interface TopGame {
  app_id: number;
  title: string;
  concurrent_users: number;
  most_played_rank: number | null;
}

interface PipelineRun {
  source: string;
  status: string;
  rows_collected: number | null;
  run_date: string;
}

interface SignalHistory {
  day: string;
  p0: number;
  p1: number;
  p2: number;
}

interface Props {
  signals: Signal[];
  topGames: TopGame[];
  pipelineStatus: PipelineRun[];
  signalHistory: SignalHistory[];
  timestamp: string;
  pipeline: string;
  isToday: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, string> = {
  new_entry_mp:    '진입',
  new_entry_wl:    'WL 진입',
  traffic_revival: 'REVIVAL',
  wishlist_surge:  'WL SURGE',
  review_spike:    'REVIEW ↑',
};

function getLabel(s: Signal) {
  if (s.signal_type === 'new_entry_mp') {
    if (s.is_first_ever_entry_mp) return '첫 진입';
    if (s.last_entry_date) {
      const days = Math.round(
        (new Date(s.signal_date).getTime() - new Date(s.last_entry_date).getTime())
        / (1000 * 60 * 60 * 24)
      );
      return days > 0 ? `${days}일만에 재진입` : '재진입';
    }
    return '재진입';
  }
  return SIGNAL_LABELS[s.signal_type] || s.signal_type;
}

function getRank(s: Signal): string | null {
  const r = s.most_played_rank ?? s.payload?.rank;
  return r ? `#${r}` : null;
}

function getCCU(s: Signal): number {
  return s.concurrent_users ?? s.payload?.concurrent_users ?? 0;
}

// Deterministic sparkline trend (no Math.random to avoid SSR mismatch)
function makeTrend(ccu: number, seed: number): number[] {
  let s = (seed ^ 0x45678abc) >>> 0;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const pts = Array.from({ length: 7 }, (_, i) => Math.round(ccu * Math.min(1, 0.35 + i * 0.095 + (rng() - 0.5) * 0.06)));
  pts[6] = ccu;
  return pts;
}

const fmt  = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtK = (n: number) => n >= 1e6 ? (n/1e6).toFixed(1).replace(/\.0$/,'')+'M' : n >= 1e3 ? (n/1e3).toFixed(1).replace(/\.0$/,'')+'K' : String(Math.round(n));

// ─── Sparkline ───────────────────────────────────────────────────────────────

function Sparkline({ data, stroke = 'var(--accent)', fill = 'transparent', height = 28, strokeWidth = 1.5 }: {
  data: number[]; stroke?: string; fill?: string; height?: number; strokeWidth?: number;
}) {
  if (!data?.length) return null;
  const W = 100, H = 28;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data.map((d, i) => [i * step, H - ((d - min) / range) * H] as [number, number]);
  const path = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return acc + ` C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, '');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, display: 'block', width: '100%' }}>
      {fill !== 'transparent' && <path d={path + ` L ${W} ${H} L 0 ${H} Z`} fill={fill} />}
      <path d={path} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ─── Signal Card ─────────────────────────────────────────────────────────────

function SignalCard({ signal, active, onClick }: { signal: Signal; active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const ccu = getCCU(signal);
  const trend = makeTrend(ccu, signal.app_id);
  const tierFg = { P0: 'var(--p0)', P1: 'var(--p1)', P2: 'var(--p2)' }[signal.priority] || 'var(--p2)';
  const tierBg = { P0: 'var(--p0-soft)', P1: 'var(--p1-soft)', P2: 'var(--p2-soft)' }[signal.priority] || 'var(--p2-soft)';

  return (
    <article
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg-elev)',
        border: `1px solid ${active || hov ? 'var(--line-strong)' : 'var(--line)'}`,
        borderRadius: 10,
        padding: 22,
        display: 'flex', flexDirection: 'column',
        cursor: 'pointer',
        transition: 'transform .15s ease, border-color .15s ease, box-shadow .15s ease',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? 'var(--shadow-sm)' : 'none',
      }}
    >
      {/* Tier + type */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.14em',
          padding: '4px 10px', borderRadius: 999,
          background: tierBg, color: tierFg,
          fontFamily: 'var(--t-mono)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 6, height: 6, background: tierFg, borderRadius: '50%' }} />
          {{ P0: 'Most Played Top 100 진입', P1: '긍정 리뷰 급상승', P2: 'Wish List 급상승' }[signal.priority] ?? signal.priority}
        </span>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10.5, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
          {getLabel(signal).toUpperCase()}
          {getRank(signal) && ` · ${getRank(signal)}`}
        </span>
      </div>

      {/* Game image */}
      {signal.header_image_url && (
        <div style={{
          aspectRatio: '16/7',
          backgroundImage: `url(${signal.header_image_url})`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          borderRadius: 4, marginBottom: 16,
          border: '1px solid var(--line)',
        }} />
      )}

      {/* Title */}
      <h3 style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: '-0.02em', fontWeight: 500, margin: '0 0 4px', color: 'var(--ink)' }}>
        {signal.title}
      </h3>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontFamily: 'var(--t-mono)' }}>
        <span>{signal.company_name || '—'}</span>
        <span style={{ color: 'var(--ink-4)' }}>·</span>
        <a
          href={`https://store.steampowered.com/app/${signal.app_id}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Steam 스토어에서 보기"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '1px 6px', borderRadius: 3,
            background: 'var(--bg-sunken)', border: '1px solid var(--line)',
            color: 'var(--ink-3)', textDecoration: 'none', fontSize: 10,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--accent)';
            e.currentTarget.style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--ink-3)';
            e.currentTarget.style.borderColor = 'var(--line)';
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.297-.249-1.908-.03l1.523.63c.956.396 1.409 1.493 1.013 2.449-.397.957-1.494 1.41-2.45 1.018zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z"/>
          </svg>
          Steam
        </a>
        {signal.is_listed && signal.stock_ticker && (
          <>
            <span style={{ color: 'var(--ink-4)' }}>·</span>
            <span style={{ color: 'var(--accent-ink)', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 3 }}>
              {signal.stock_ticker}
            </span>
          </>
        )}
      </div>

      {/* CCU + sparkline */}
      <div style={{
        display: 'flex', alignItems: 'flex-end',
        padding: '14px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 4 }}>
            PEAK CCU
          </div>
          <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(ccu)}
          </div>
        </div>
        <div style={{ flex: 1, marginLeft: 20 }}>
          <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 6 }}>
            7-DAY
          </div>
          <Sparkline data={trend} stroke="var(--accent)" fill="rgba(59,91,219,0.08)" height={44} strokeWidth={1.75} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
          {signal.signal_date}
        </span>
        <span style={{
          fontSize: 15,
          color: active || hov ? 'var(--accent)' : 'var(--ink-4)',
          transform: hov ? 'translateX(3px)' : 'none',
          transition: 'all .2s',
        }}>→</span>
      </div>
    </article>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TerminalDashboard({ signals, topGames, pipelineStatus, timestamp, isToday }: Props) {
  const [tierFilter, setTierFilter] = useState<'ALL' | 'P0' | 'P1' | 'P2'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = tierFilter === 'ALL' ? signals : signals.filter(s => s.priority === tierFilter);

  // KPI computations
  const totalCCU = topGames.reduce((a, g) => a + (g.concurrent_users || 0), 0);
  const p0Count  = signals.filter(s => s.priority === 'P0').length;
  const okRuns   = pipelineStatus.filter(p => p.status === 'success').length;

  const kpis = [
    { label: 'TOTAL TOP10 CCU', value: fmtK(totalCCU) },
    { label: 'SIGNALS',         value: String(signals.length) },
    { label: 'P0 ALERTS',       value: String(p0Count) },
    { label: 'PIPELINE',        value: `${okRuns}/${pipelineStatus.length} OK` },
  ];

  return (
    <div className="gs-page">

      {/* ── Page header ───────────────────────────────────────────── */}
      <header style={{ marginBottom: 36 }}>
        <span className="gs-eyebrow">01 — LIVE INTELLIGENCE</span>
        <h1 className="gs-h1">{isToday ? `Today's Noise.` : `Recent Noise.`}</h1>
        <p className="gs-deck">
          추적 중인 타이틀에서 발생한 의미 있는 변화. 업데이트 {timestamp}.
        </p>
      </header>

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        border: '1px solid var(--line)', borderRadius: 10,
        background: 'var(--bg-elev)', overflow: 'hidden',
        marginBottom: 36,
      }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{
            padding: '18px 22px',
            borderRight: i < kpis.length - 1 ? '1px solid var(--line)' : 'none',
          }}>
            <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 8 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {k.value}
            </div>
          </div>
        ))}
      </section>

      {/* ── Filter toolbar ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '14px 0',
        borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
        marginBottom: 28,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['ALL', 'P0', 'P1', 'P2'] as const).map(t => {
            const label: Record<string, string> = {
              ALL: 'All',
              P0: 'Most Played Top 100 진입',
              P1: '긍정 리뷰 급상승',
              P2: 'Wish List 급상승',
            };
            return (
              <button
                key={t}
                onClick={() => setTierFilter(t)}
                style={{
                  fontSize: 13, padding: '8px 14px', borderRadius: 999,
                  color: tierFilter === t ? '#fff' : 'var(--ink-3)',
                  background: tierFilter === t ? 'var(--ink)' : 'transparent',
                  fontWeight: tierFilter === t ? 500 : 400,
                  transition: 'background .15s, color .15s',
                }}
              >
                {label[t]}
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
          {filtered.length} signals · {topGames.length} games tracked
        </span>
      </div>

      {/* ── Signal feed ───────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <span className="gs-section-label">TODAY&apos;S CATCH</span>
        {filtered.length === 0 ? (
          <div style={{
            padding: '56px 0', textAlign: 'center',
            color: 'var(--ink-4)', fontFamily: 'var(--t-mono)', fontSize: 12,
          }}>
            NO SIGNALS FOR THIS FILTER
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: 18, marginTop: 12,
          }}>
            {filtered.map(s => (
              <SignalCard
                key={s.signal_id}
                signal={s}
                active={s.signal_id === selectedId}
                onClick={() => setSelectedId(prev => prev === s.signal_id ? null : s.signal_id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Lower: Trend chart + Top 10 ───────────────────────────── */}
      <section>

        {/* Steam Top 10 */}
        <div style={{ background: 'var(--bg-elev)', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
            <span className="gs-section-label" style={{ marginBottom: 4 }}>STEAM TOP 10</span>
            <h3 style={{ fontSize: 20, letterSpacing: '-0.02em', fontWeight: 500, margin: 0 }}>Most played now</h3>
          </div>
          <div>
            {topGames.slice(0, 10).map((g, i) => (
              <Link
                key={g.app_id}
                href={`https://store.steampowered.com/app/${g.app_id}`}
                target="_blank" rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 22px',
                  borderBottom: i < 9 ? '1px solid var(--line)' : 'none',
                  textDecoration: 'none',
                  transition: 'background .1s',
                }}
                className="gs-top-row"
              >
                <span style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-4)', width: 26, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.title}
                </span>
                <span style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {fmtK(g.concurrent_users)}
                </span>
              </Link>
            ))}
          </div>
        </div>

      </section>

    </div>
  );
}
