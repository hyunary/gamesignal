'use client';

import { useState, useEffect, useRef } from 'react';
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
  signal_date: string;
}

interface TopGame {
  app_id: number;
  title: string;
  concurrent_users: number;
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

// ─── Display signal type ──────────────────────────────────────────────────────

const SIGNAL_TYPE_LABEL: Record<string, string> = {
  new_entry_mp: 'Most Played 진입',
  new_entry_wl: 'Wish List 진입',
  traffic_revival: 'REVIVAL',
  wishlist_surge: 'WL SURGE',
  review_spike: 'REVIEW ↑',
  composite: 'COMPOSITE',
};

function getSignalLabel(s: Signal): string {
  if (s.signal_type === 'new_entry_mp') {
    return s.is_first_ever_entry_mp ? '처음 진입' : '재진입';
  }
  return SIGNAL_TYPE_LABEL[s.signal_type] || s.signal_type;
}

function getSignalRank(s: Signal): string | null {
  const rank = s.most_played_rank ?? s.payload?.rank;
  return rank ? `#${rank}` : null;
}

function getCCU(s: Signal): number {
  return s.concurrent_users ?? s.payload?.concurrent_users ?? 0;
}

function generateTrend(ccu: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 7; i++) {
    const factor = 0.35 + i * 0.095 + (Math.random() - 0.5) * 0.06;
    pts.push(Math.round(ccu * Math.min(1, factor)));
  }
  pts[6] = ccu;
  return pts;
}

// ─── Formatters ──────────────────────────────────────────────────────────────

const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtK = (n: number) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
};
const signed = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';

// ─── Primitive Components ─────────────────────────────────────────────────────

function CountUp({ value, duration = 900, suffix = '' }: { value: number; duration?: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);
  useEffect(() => {
    const from = fromRef.current;
    startRef.current = null;
    let raf: number;
    const step = (t: number) => {
      if (!startRef.current) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{fmt(v)}{suffix}</>;
}

function Sparkline({
  data, stroke = 'var(--accent)', fill = 'transparent', height = 28, strokeWidth = 1.5,
}: { data: number[]; stroke?: string; fill?: string; height?: number; strokeWidth?: number }) {
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
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
      style={{ height, display: 'block', width: '100%' }}>
      {fill !== 'transparent' && <path d={path + ` L ${W} ${H} L 0 ${H} Z`} fill={fill} />}
      <path d={path} stroke={stroke} strokeWidth={strokeWidth} fill="none"
        strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function AreaChart({ series, labels, height = 180, colors = ['#C23C3C', '#C78A00', '#5C6B82'] }: {
  series: { name: string; data: number[] }[];
  labels: string[];
  height?: number;
  colors?: string[];
}) {
  const W = 600, H = height;
  const pad = { l: 28, r: 8, t: 8, b: 20 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const n = labels.length;
  const max = Math.max(1, ...labels.map((_, i) => series.reduce((a, s) => a + (s.data[i] || 0), 0)));
  const stepX = cw / Math.max(n - 1, 1);
  const toY = (v: number) => pad.t + ch - (v / max) * ch;
  const stacks = labels.map((_, i) => {
    let y = 0;
    return series.map(s => { const v = s.data[i] || 0; const r = { y, v }; y += v; return r; });
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <line key={i} x1={pad.l} x2={W - pad.r} y1={pad.t + ch * t} y2={pad.t + ch * t}
          stroke="var(--line)" strokeWidth="1" />
      ))}
      {series.map((s, si) => {
        const top = labels.map((_, i) => [pad.l + i * stepX, toY(stacks[i].slice(0, si + 1).reduce((a, b) => a + b.v, 0))] as [number, number]);
        const bot = [...labels.map((_, i) => [pad.l + i * stepX, toY(stacks[i].slice(0, si).reduce((a, b) => a + b.v, 0))] as [number, number])].reverse();
        const d = [...top, ...bot].map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + ' Z';
        return <path key={si} d={d} fill={colors[si]} opacity="0.85" />;
      })}
      {labels.map((l, i) => (
        <text key={i} x={pad.l + i * stepX} y={H - 4} textAnchor="middle"
          fontSize="10" fontFamily="var(--t-mono)" fill="var(--ink-4)">{l}</text>
      ))}
    </svg>
  );
}

function TierPill({ tier }: { tier: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    P0: { bg: 'var(--p0-soft)', fg: 'var(--p0)' },
    P1: { bg: 'var(--p1-soft)', fg: 'var(--p1)' },
    P2: { bg: 'var(--p2-soft)', fg: 'var(--p2)' },
  };
  const s = map[tier] || map.P2;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.08em', background: s.bg, color: s.fg, padding: '3px 7px', borderRadius: 999, fontFamily: 'var(--t-mono)', whiteSpace: 'nowrap' }}>
      {tier}
    </span>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Delta({ value, size = 12 }: { value: number; size?: number }) {
  const up = value >= 0;
  return (
    <span style={{ fontSize: size, fontWeight: 600, fontFamily: 'var(--t-mono)', color: up ? 'var(--pos)' : 'var(--neg)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <svg width="7" height="7" viewBox="0 0 8 8">
        {up ? <path d="M4 1 L7 6 L1 6 Z" fill="currentColor" /> : <path d="M4 7 L1 2 L7 2 Z" fill="currentColor" />}
      </svg>
      {signed(value)}
    </span>
  );
}

function Pulse({ color = 'var(--pos)' }: { color?: string }) {
  return (
    <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block', flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: color, animation: 'gspulse 1.8s ease-out infinite' }} />
      <span style={{ position: 'absolute', inset: 2, borderRadius: '50%', background: color }} />
    </span>
  );
}

// ─── Terminal Row ─────────────────────────────────────────────────────────────

function TerminalRow({ signal, active, onClick }: { signal: Signal; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const ccu = getCCU(signal);
  const trend = generateTrend(ccu);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto minmax(0,1.6fr) minmax(0,1fr) 80px 55px 70px',
        gap: 10,
        padding: '9px 16px 9px 12px',
        alignItems: 'center',
        borderBottom: '1px solid var(--line)',
        borderLeft: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        cursor: 'pointer',
        transition: 'background .1s',
        background: active ? 'var(--accent-soft)' : hovered ? 'var(--bg-sunken)' : 'transparent',
      }}>
      <TierPill tier={signal.priority} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {signal.header_image_url && (
          <div style={{
            width: 40, height: 20, backgroundImage: `url(${signal.header_image_url})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderRadius: 2, border: '1px solid var(--line)', flexShrink: 0,
          }} />
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
            {signal.title}
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'var(--t-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {signal.company_name || '—'}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {getSignalLabel(signal)}
        {getSignalRank(signal) && (
          <span style={{ color: 'var(--ink-4)', marginLeft: 5, fontFamily: 'var(--t-mono)', fontSize: 10 }}>
            {getSignalRank(signal)}
          </span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--t-mono)', fontSize: 12, textAlign: 'right', color: 'var(--ink)' }}>
        {fmtK(ccu)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ color: 'var(--ink-4)', fontSize: 11, fontFamily: 'var(--t-mono)' }}>—</span>
      </div>
      <div>
        <Sparkline data={trend} stroke={active ? 'var(--accent)' : 'var(--ink-4)'} height={20} />
      </div>
    </div>
  );
}

// ─── Panel shell ──────────────────────────────────────────────────────────────

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-elev)', border: '1px solid var(--line)',
      borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column',
      ...style,
    }}>
      {children}
    </div>
  );
}

function PanelHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 14px', borderBottom: '1px solid var(--line)',
      background: 'var(--bg-sunken)', flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', color: 'var(--ink)' }}>{children}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TerminalDashboard({ signals, topGames, pipelineStatus, signalHistory, timestamp, pipeline, isToday }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(signals[0]?.signal_id ?? null);
  const [tierFilter, setTierFilter] = useState<'ALL' | 'P0' | 'P1' | 'P2'>('ALL');

  const sel = signals.find(s => s.signal_id === selectedId) ?? signals[0] ?? null;
  const filteredSignals = tierFilter === 'ALL' ? signals : signals.filter(s => s.priority === tierFilter);

  // KPI strip data
  const totalToday = signals.filter(s => s.signal_date === signals[0]?.signal_date).length;
  const p0Count7d = signalHistory.reduce((a, d) => a + d.p0, 0);
  const successCount = pipelineStatus.filter((p: any) => p.status === 'success').length;

  // Unique pipeline sources (latest run per source)
  const pipelineSources = Array.from(
    pipelineStatus.reduce((map, p) => {
      if (!map.has(p.source)) map.set(p.source, p);
      return map;
    }, new Map<string, PipelineRun>()).values()
  ).slice(0, 5);

  const kpiItems = [
    { label: 'SIGNALS TODAY', value: totalToday, suffix: '' },
    { label: 'GAMES TRACKED', value: topGames.length, suffix: '' },
    { label: 'P0 · 7D', value: p0Count7d, suffix: '' },
    { label: 'PIPELINE', value: successCount, suffix: `/${pipelineSources.length}` },
    { label: 'TOP CCU', value: topGames[0]?.concurrent_users ?? 0, suffix: '', format: fmtK },
    { label: 'DATA SOURCES', value: pipelineSources.length, suffix: '' },
  ];

  const TABS = [
    { key: 'signals', label: 'Signals', href: '/' },
    { key: 'news', label: 'News', href: '/news' },
    { key: 'forecasting', label: 'Forecasting', href: '/forecasting' },
    { key: 'watchlist', label: 'Watchlist', href: '#', disabled: true },
    { key: 'publishers', label: 'Publishers', href: '#', disabled: true },
  ];

  return (
    <div className="gs-terminal" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Command bar ────────────────────────────────────────────── */}
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
          <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <Pulse /> {timestamp}
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

      {/* ── Sub-nav tabs ───────────────────────────────────────────── */}
      <nav style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--line)', padding: '0 24px', background: 'var(--bg-elev)', flexShrink: 0 }}>
        {TABS.map(t => (
          <Link key={t.key} href={t.disabled ? '#' : t.href}
            style={{
              fontSize: 13, padding: '11px 13px', color: t.disabled ? 'var(--ink-4)' : (t.key === 'signals' ? 'var(--ink)' : 'var(--ink-3)'),
              borderBottom: t.key === 'signals' ? '2px solid var(--ink)' : '2px solid transparent',
              fontWeight: t.key === 'signals' ? 500 : 400,
              marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 7,
              textDecoration: 'none', whiteSpace: 'nowrap', cursor: t.disabled ? 'default' : 'pointer',
            }}>
            {t.label}
            {t.key === 'signals' && signals.length > 0 && (
              <span style={{
                fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                padding: '2px 6px', borderRadius: 999, fontFamily: 'var(--t-mono)', fontWeight: 600,
              }}>{signals.length}</span>
            )}
          </Link>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--line)', borderRadius: 5, overflow: 'hidden', background: 'var(--bg)' }}>
          {['1D', '7D', '30D', '90D'].map((s, i) => (
            <button key={s} style={{
              fontSize: 11, padding: '5px 9px', color: i === 0 ? 'var(--ink)' : 'var(--ink-3)',
              background: i === 0 ? 'var(--bg-sunken)' : 'transparent',
              borderRight: i < 3 ? '1px solid var(--line)' : 'none',
              fontFamily: 'var(--t-mono)', cursor: 'pointer', fontWeight: i === 0 ? 500 : 400,
            }}>{s}</button>
          ))}
        </div>
      </nav>

      {/* ── KPI strip ──────────────────────────────────────────────── */}
      <section style={{
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
        border: '1px solid var(--line)', borderLeft: 'none', borderRight: 'none',
        background: 'var(--bg-elev)', flexShrink: 0,
      }}>
        {kpiItems.map((k, i) => (
          <div key={i} style={{
            padding: '12px 18px',
            borderRight: i < 5 ? '1px solid var(--line)' : 'none',
          }}>
            <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.015em', color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
              {k.format
                ? k.format(k.value) + k.suffix
                : <><CountUp value={k.value} />{k.suffix}</>
              }
            </div>
          </div>
        ))}
      </section>

      {/* ── 3-column grid ──────────────────────────────────────────── */}
      <section style={{
        display: 'grid', gridTemplateColumns: '1.5fr 1fr 0.85fr',
        gap: 14, padding: '14px 24px', flex: 1, minHeight: 0,
      }}>

        {/* ─ LEFT: Signal feed ─────────────────────────────────────── */}
        <Panel>
          <PanelHead>
            <PanelTitle>Signal Feed</PanelTitle>
            <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {filteredSignals.length} active
            </span>
            {isToday && (
              <span style={{
                fontSize: 10, background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                padding: '2px 6px', borderRadius: 999, fontFamily: 'var(--t-mono)', fontWeight: 600,
              }}>TODAY</span>
            )}
            <div style={{ flex: 1 }} />
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              {(['ALL', 'P0', 'P1', 'P2'] as const).map(t => (
                <button key={t} onClick={() => setTierFilter(t)} style={{
                  fontSize: 10, padding: '3px 8px',
                  color: tierFilter === t ? '#fff' : 'var(--ink-3)',
                  background: tierFilter === t ? 'var(--ink)' : 'transparent',
                  borderRight: t !== 'P2' ? '1px solid var(--line)' : 'none',
                  fontFamily: 'var(--t-mono)', cursor: 'pointer',
                }}>{t}</button>
              ))}
            </div>
          </PanelHead>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'auto minmax(0,1.6fr) minmax(0,1fr) 80px 55px 70px',
            gap: 10, padding: '8px 16px 8px 12px',
            fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em',
            fontFamily: 'var(--t-mono)', borderBottom: '1px solid var(--line)',
            background: 'var(--bg)', flexShrink: 0,
          }}>
            <span>TIER</span><span>GAME</span><span>SIGNAL</span>
            <span style={{ textAlign: 'right' }}>CCU</span>
            <span style={{ textAlign: 'right' }}>Δ%</span>
            <span>7D</span>
          </div>

          {/* Rows */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredSignals.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--ink-4)', fontFamily: 'var(--t-mono)', fontSize: 12 }}>
                NO SIGNALS
              </div>
            ) : (
              filteredSignals.map(s => (
                <TerminalRow
                  key={s.signal_id}
                  signal={s}
                  active={s.signal_id === selectedId}
                  onClick={() => setSelectedId(s.signal_id)}
                />
              ))
            )}
          </div>

          {/* Area chart */}
          <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px 6px', borderBottom: '1px solid var(--line)' }}>
              <PanelTitle>Signal Volume · 7D</PanelTitle>
              <div style={{ flex: 1 }} />
              {[{ c: 'var(--p0)', l: 'P0' }, { c: 'var(--p1)', l: 'P1' }, { c: 'var(--p2)', l: 'P2' }].map(x => (
                <span key={x.l} style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-2)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, background: x.c, borderRadius: 1, display: 'inline-block' }} />{x.l}
                </span>
              ))}
            </div>
            <div style={{ padding: '8px 14px 4px' }}>
              <AreaChart
                labels={signalHistory.map(d => d.day)}
                series={[
                  { name: 'P0', data: signalHistory.map(d => d.p0) },
                  { name: 'P1', data: signalHistory.map(d => d.p1) },
                  { name: 'P2', data: signalHistory.map(d => d.p2) },
                ]}
                colors={['#C23C3C', '#C78A00', '#5C6B82']}
                height={150}
              />
            </div>
          </div>
        </Panel>

        {/* ─ MIDDLE: Signal detail ─────────────────────────────────── */}
        <Panel>
          <PanelHead>
            <PanelTitle>Signal Detail</PanelTitle>
            {sel && <TierPill tier={sel.priority} />}
            <div style={{ flex: 1 }} />
            <a href={sel ? `https://store.steampowered.com/app/${sel.app_id}` : '#'}
              target="_blank" rel="noopener noreferrer"
              style={{
                padding: '4px 10px', background: 'var(--ink)', color: '#fff',
                borderRadius: 5, fontSize: 11, fontWeight: 500, textDecoration: 'none',
              }}>
              Steam ↗
            </a>
          </PanelHead>

          {sel ? (
            <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
              {sel.header_image_url && (
                <div style={{
                  aspectRatio: '16/7', backgroundImage: `url(${sel.header_image_url})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  borderRadius: 6, border: '1px solid var(--line)',
                }} />
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 14 }}>
                <span style={{
                  fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-2)',
                  background: 'var(--bg-sunken)', padding: '3px 7px', borderRadius: 4, letterSpacing: '.06em',
                }}>
                  {getSignalLabel(sel)}
                </span>
                {getSignalRank(sel) && (
                  <span style={{
                    fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-2)',
                    background: 'var(--bg-sunken)', padding: '3px 7px', borderRadius: 4,
                  }}>{getSignalRank(sel)}</span>
                )}
                {sel.is_listed && sel.stock_ticker && (
                  <span style={{
                    fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--accent-ink)',
                    background: 'var(--accent-soft)', padding: '3px 7px', borderRadius: 4,
                  }}>📊 {sel.stock_ticker}</span>
                )}
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', margin: '8px 0 4px', color: 'var(--ink)' }}>
                {sel.title}
              </h2>
              <div style={{ fontFamily: 'var(--t-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                {sel.company_name || '—'} · app/{sel.app_id}
              </div>

              {/* CCU + Sparkline */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14,
                marginTop: 18, padding: '14px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>CCU · LIVE</div>
                  <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.02em', marginTop: 6, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
                    {fmt(getCCU(sel))}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>7-DAY TREND</div>
                  <Sparkline data={generateTrend(getCCU(sel))} stroke="var(--accent)" fill="var(--accent-soft)" height={52} strokeWidth={2} />
                </div>
              </div>

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0, marginTop: 12 }}>
                {[
                  ['Signal Type', SIGNAL_TYPE_LABEL[sel.signal_type] || sel.signal_type],
                  ['Priority', sel.priority],
                  ['Signal Date', sel.signal_date],
                  ['Listed', sel.is_listed ? '상장사' : '비상장'],
                  ['Ticker', sel.stock_ticker || '—'],
                  ['Rank', getSignalRank(sel) || '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.1em', textTransform: 'uppercase' }}>{k}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3, color: 'var(--ink)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-4)', fontFamily: 'var(--t-mono)', fontSize: 12 }}>
              SELECT A SIGNAL
            </div>
          )}
        </Panel>

        {/* ─ RIGHT: Top 10 + Pipeline ──────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Steam Top 10 */}
          <Panel style={{ flex: 1, minHeight: 0 }}>
            <PanelHead>
              <PanelTitle>Steam Top 10</PanelTitle>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)' }}>BY CCU</span>
            </PanelHead>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {topGames.slice(0, 10).map((g, i) => (
                <a key={g.app_id}
                  href={`https://store.steampowered.com/app/${g.app_id}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'grid', gridTemplateColumns: '26px 1fr auto',
                    alignItems: 'center', gap: 8, padding: '7px 14px',
                    borderBottom: '1px solid var(--line)', textDecoration: 'none',
                    transition: 'background .1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-sunken)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ink)' }}>
                    {g.title}
                  </span>
                  <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                    {fmtK(g.concurrent_users)}
                  </span>
                </a>
              ))}
            </div>
          </Panel>

          {/* Pipeline */}
          <Panel style={{ flexShrink: 0 }}>
            <PanelHead>
              <PanelTitle>Pipeline</PanelTitle>
              <div style={{ flex: 1 }} />
              <Pulse />
            </PanelHead>
            <div style={{ padding: '2px 0 4px' }}>
              {pipelineSources.map(p => {
                const ok = p.status === 'success';
                const running = p.status === 'running';
                return (
                  <div key={p.source} style={{
                    display: 'grid', gridTemplateColumns: '12px 1fr auto',
                    alignItems: 'center', gap: 10, padding: '7px 14px',
                    borderBottom: '1px solid var(--line)',
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: ok ? 'var(--pos)' : running ? 'var(--p1)' : 'var(--neg)',
                      display: 'inline-block', flexShrink: 0,
                    }} />
                    <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11.5, color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.source}
                    </span>
                    <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)', textAlign: 'right' }}>
                      {p.rows_collected != null ? p.rows_collected : p.status.toUpperCase()}
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

        </div>
      </section>

      {/* ── Status bar ─────────────────────────────────────────────── */}
      <footer style={{
        display: 'flex', alignItems: 'center', gap: 18,
        padding: '7px 24px', background: 'var(--bg-sunken)',
        borderTop: '1px solid var(--line)', flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Pulse /> CONNECTED · steam.api
        </span>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)' }}>REGION KR</span>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)' }}>
          {isToday ? '🟢 TODAY\'S DATA' : '🟡 RECENT DATA'}
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
