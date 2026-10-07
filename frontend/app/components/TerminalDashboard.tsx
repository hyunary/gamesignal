'use client';

import { useState } from 'react';
import Link from 'next/link';
import PageHeading from '@/app/components/PageHeading';

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

interface CCUPoint {
  app_id: number;
  date: string;
  ccu: number;
}

interface SignalCounts {
  total: number;
  p0: number;
  p1: number;
  p2: number;
}

interface Props {
  signals: Signal[];
  topGames: TopGame[];
  pipelineStatus: PipelineRun[];
  signalHistory: SignalHistory[];
  pipelineLabel: string;
  isToday: boolean;
  ccuHistory: CCUPoint[];
  signalCounts: SignalCounts | null;
  today: string;
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

function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - days);
  return dt.toISOString().slice(0, 10);
}

function isGameTemp(title: string): boolean {
  return /^Game_\d+$/.test(title);
}

const fmt  = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const fmtK = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : String(Math.round(n));

// ─── Sparkline ───────────────────────────────────────────────────────────────
// 가로축: signal_date 기준 7칸(slot 0~6). 날짜 간격이 실제 일수에 비례.
// 빈 날(gap > 1 slot)은 선을 잇지 않고 끊는다. 각 점에 dot 표시.

function Sparkline({
  data,
  endDate,
  stroke = 'var(--accent)',
  fill = 'transparent',
  height = 28,
  strokeWidth = 1.5,
}: {
  data: { date: string; ccu: number }[];
  endDate: string;
  stroke?: string;
  fill?: string;
  height?: number;
  strokeWidth?: number;
}) {
  if (!data?.length) return null;

  const W = 100, H = 28;

  const [ey, em, ed] = endDate.split('-').map(Number);
  const endMs = new Date(ey, em - 1, ed).getTime();

  // Map each data point to slot 0-6 (slot 6 = endDate, slot 0 = endDate-6)
  const pts = data
    .map(d => {
      const [dy, dm, dd] = d.date.split('-').map(Number);
      const slot = Math.round((new Date(dy, dm - 1, dd).getTime() - endMs) / 86400000) + 6;
      return { slot, ccu: d.ccu };
    })
    .filter(p => p.slot >= 0 && p.slot <= 6)
    .sort((a, b) => a.slot - b.slot);

  if (pts.length < 1) return null;

  const minCCU = Math.min(...pts.map(p => p.ccu));
  const maxCCU = Math.max(...pts.map(p => p.ccu));
  const ccuRange = maxCCU - minCCU || 1;

  const toX = (slot: number) => (slot / 6) * W;
  const toY = (ccu: number) => H - ((ccu - minCCU) / ccuRange) * H;

  // Build path: connect consecutive slots (gap==1) with cubic bezier; break on gap>1
  let linePath = '';
  for (let i = 0; i < pts.length; i++) {
    const x = toX(pts[i].slot);
    const y = toY(pts[i].ccu);
    if (i === 0 || pts[i].slot - pts[i - 1].slot > 1) {
      linePath += `${linePath ? ' ' : ''}M ${x.toFixed(2)} ${y.toFixed(2)}`;
    } else {
      const px = toX(pts[i - 1].slot);
      const py = toY(pts[i - 1].ccu);
      const cx = (px + x) / 2;
      linePath += ` C ${cx.toFixed(2)} ${py.toFixed(2)}, ${cx.toFixed(2)} ${y.toFixed(2)}, ${x.toFixed(2)} ${y.toFixed(2)}`;
    }
  }

  // Fill only when no gaps (broken path can't be cleanly filled)
  const hasGaps = pts.some((p, i) => i > 0 && p.slot - pts[i - 1].slot > 1);
  const fillPath = !hasGaps && pts.length >= 2 && fill !== 'transparent'
    ? `${linePath} L ${toX(pts[pts.length - 1].slot).toFixed(2)} ${H} L ${toX(pts[0].slot).toFixed(2)} ${H} Z`
    : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height, display: 'block', width: '100%' }}>
      {fillPath && <path d={fillPath} fill={fill} />}
      <path d={linePath} stroke={stroke} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => (
        <circle key={i} cx={toX(p.slot)} cy={toY(p.ccu)} r={1.5} fill={stroke} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

// ─── Signal Card ─────────────────────────────────────────────────────────────

function SignalCard({ signal, ccuPoints }: { signal: Signal; ccuPoints: { date: string; ccu: number }[] }) {
  const [hov, setHov] = useState(false);
  const ccu = getCCU(signal);
  const tierFg = ({ P0: 'var(--p0)', P1: 'var(--p1)', P2: 'var(--p2)' } as Record<string, string>)[signal.priority] ?? 'var(--p2)';
  const tierBg = ({ P0: 'var(--p0-soft)', P1: 'var(--p1-soft)', P2: 'var(--p2-soft)' } as Record<string, string>)[signal.priority] ?? 'var(--p2-soft)';

  const startDate = subtractDays(signal.signal_date, 6);
  const trend = ccuPoints.filter(p => p.date >= startDate && p.date <= signal.signal_date);
  const hasTrend = trend.length >= 2;

  const displayTitle = isGameTemp(signal.title)
    ? `게임명 확인 중 · app id ${signal.app_id}`
    : signal.title;

  const tierLabel = ({ P0: 'Most Played Top 100 진입', P1: '긍정 리뷰 급상승', P2: 'Wish List 급상승' } as Record<string, string>)[signal.priority] ?? signal.priority;

  return (
    <article
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: 'var(--bg-elev)',
        border: `1px solid ${hov ? 'var(--line-strong)' : 'var(--line)'}`,
        borderRadius: 'var(--r)',
        padding: 22,
        display: 'flex', flexDirection: 'column',
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
          {tierLabel}
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
          borderRadius: 'var(--r)', marginBottom: 16,
          border: '1px solid var(--line)',
        }} />
      )}

      {/* Title */}
      <h3 style={{ fontSize: 22, lineHeight: 1.15, letterSpacing: '-0.02em', fontWeight: 500, margin: '0 0 4px', color: 'var(--ink)' }}>
        {displayTitle}
      </h3>
      <div style={{ fontSize: 12, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 18, fontFamily: 'var(--t-mono)', flexWrap: 'wrap' }}>
        <span>{signal.company_name || '—'}</span>
        {signal.is_listed && signal.stock_ticker && (
          <>
            <span style={{ color: 'var(--ink-4)' }}>·</span>
            <span style={{ color: 'var(--accent-ink)', background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 'var(--r)' }}>
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
            CCU · 06:00 수집
          </div>
          <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {ccu > 0 ? fmt(ccu) : '—'}
          </div>
        </div>
        <div style={{ flex: 1, marginLeft: 20 }}>
          <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 6 }}>
            7일 추이 · 06:00 수집 기준
          </div>
          {hasTrend ? (
            <Sparkline data={trend} endDate={signal.signal_date} stroke="var(--accent)" fill="var(--accent-soft)" height={44} strokeWidth={1.75} />
          ) : (
            <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', letterSpacing: '.06em', height: 44, display: 'flex', alignItems: 'center' }}>
              추이 데이터 부족
            </div>
          )}
        </div>
      </div>

      {/* Footer: date + Steam link */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12 }}>
        <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.06em' }}>
          {signal.signal_date}
        </span>
        <a
          href={`https://store.steampowered.com/app/${signal.app_id}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 9px', borderRadius: 'var(--r)',
            background: 'var(--bg-sunken)', border: '1px solid var(--line)',
            color: 'var(--ink-3)', textDecoration: 'none', fontSize: 11,
            fontFamily: 'var(--t-mono)', transition: 'color .15s, border-color .15s',
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
            <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.297-.249-1.908-.03l1.523.63c.956.396 1.409 1.493 1.013 2.449-.397.957-1.494 1.41-2.45 1.018zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.662 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.252 0-2.265-1.014-2.265-2.265z" />
          </svg>
          Steam
        </a>
      </div>
    </article>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TerminalDashboard({
  signals, topGames, pipelineStatus, pipelineLabel, isToday,
  ccuHistory, signalCounts, today,
}: Props) {
  const [tierFilter, setTierFilter] = useState<'ALL' | 'P0' | 'P1' | 'P2'>('ALL');

  const filtered = tierFilter === 'ALL' ? signals : signals.filter(s => s.priority === tierFilter);

  // KPI
  const top10CCU = topGames.slice(0, 10).reduce((a, g) => a + (g.concurrent_users || 0), 0);
  const top10Missing = topGames.length === 0;
  const okRuns = pipelineStatus.filter(p => p.status === 'success').length;
  const pipelineMissing = pipelineStatus.length === 0;
  const pipelineSuccessToday = pipelineStatus.some(p =>
    p.status === 'success' && String(p.run_date ?? '').slice(0, 10) === today
  );
  const signalsMissing = signalCounts === null
    || (isToday && signalCounts.total === 0 && !pipelineSuccessToday);

  const recentStart = subtractDays(today, 7);
  const rangeSuffix = isToday ? '' : ` · ${recentStart.slice(5)}~${today.slice(5)}`;

  const kpis = [
    { label: 'TOP 10 CCU',            value: top10Missing    ? '—' : fmtK(top10CCU),                    sub: top10Missing    ? '데이터 미수신' : '' },
    { label: `SIGNALS${rangeSuffix}`,  value: signalsMissing  ? '—' : String(signalCounts?.total ?? 0), sub: signalsMissing  ? '데이터 미수신' : '' },
    { label: `P0 ALERTS${rangeSuffix}`,value: signalsMissing  ? '—' : String(signalCounts?.p0 ?? 0),    sub: signalsMissing  ? '데이터 미수신' : '' },
    { label: 'PIPELINE',               value: pipelineMissing ? '—' : `${okRuns}/${pipelineStatus.length}`, sub: pipelineMissing ? '데이터 미수신' : '' },
  ];

  // Index CCU history by app_id
  const ccuByApp = new Map<number, { date: string; ccu: number }[]>();
  for (const h of ccuHistory) {
    if (!ccuByApp.has(h.app_id)) ccuByApp.set(h.app_id, []);
    ccuByApp.get(h.app_id)!.push({ date: h.date, ccu: h.ccu });
  }

  const totalCount = signalCounts?.total ?? signals.length;

  const filterLabels: Record<string, string> = {
    ALL: '전체',
    P0: 'Top 100 진입',
    P1: '긍정 리뷰',
    P2: '위시리스트',
  };

  const tierGuide: { priority: string; fg: string; bg: string; desc: string }[] = [
    { priority: 'P0', fg: 'var(--p0)', bg: 'var(--p0-soft)', desc: 'Most Played Top 100 진입 · 즉시 확인' },
    { priority: 'P1', fg: 'var(--p1)', bg: 'var(--p1-soft)', desc: '긍정 리뷰 급상승 · 중요 변화' },
    { priority: 'P2', fg: 'var(--p2)', bg: 'var(--p2-soft)', desc: 'Wish List 급상승 · 지속 관찰' },
  ];

  return (
    <div className="gs-page">

      {/* ── Page header ───────────────────────────────────────────── */}
      <PageHeading
        eyebrow="03 — LIVE INTELLIGENCE"
        title={isToday ? "Today's signals." : "Recent signals."}
        description="추적 중인 타이틀에서 발생한 의미 있는 변화."
        timeLabel="파이프라인"
        timeValue={pipelineLabel}
      />

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <section className="nc-kpi-grid" style={{
        border: '1px solid var(--line)', borderRadius: 'var(--r)',
        background: 'var(--bg-elev)', overflow: 'hidden', marginBottom: 36,
      }}>
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={`nc-kpi-cell-${i + 1}`}
            style={{
              padding: '18px 22px',
              borderRight: i < kpis.length - 1 ? '1px solid var(--line)' : 'none',
            }}
          >
            <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '.14em', marginBottom: 8 }}>
              {k.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {k.value}
            </div>
            {k.sub && (
              <div style={{ fontFamily: 'var(--t-mono)', fontSize: 10, color: 'var(--ink-4)', marginTop: 6, letterSpacing: '.08em' }}>
                {k.sub}
              </div>
            )}
          </div>
        ))}
      </section>

      {/* ── Main grid ─────────────────────────────────────────────── */}
      <div className="nc-dash-grid">

        {/* Main column */}
        <div>

          {/* Filter toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '14px 0',
            borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)',
            marginBottom: 28,
          }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['ALL', 'P0', 'P1', 'P2'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  style={{
                    fontSize: 13, padding: '8px 14px', borderRadius: 0,
                    color: tierFilter === t ? 'var(--on-ink)' : 'var(--ink-3)',
                    background: tierFilter === t ? 'var(--ink)' : 'transparent',
                    fontWeight: tierFilter === t ? 500 : 400,
                    transition: 'background .15s, color .15s',
                  }}
                >
                  {filterLabels[t]}
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)', letterSpacing: '.08em' }}>
              {filtered.length < totalCount
                ? `${totalCount} signals 중 ${filtered.length} 표시`
                : `${filtered.length} signals`}
            </span>
          </div>

          {/* Signal feed */}
          <section style={{ marginBottom: 48 }}>
            <span className="gs-section-label">{isToday ? "TODAY'S CATCH" : 'RECENT CATCH'}</span>
            {filtered.length === 0 ? (
              <div style={{
                padding: '56px 0', textAlign: 'center',
                color: 'var(--ink-4)', fontFamily: 'var(--t-mono)', fontSize: 12,
              }}>
                NO SIGNALS FOR THIS FILTER
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 12 }}>
                {filtered.map(s => (
                  <SignalCard
                    key={s.signal_id}
                    signal={s}
                    ccuPoints={ccuByApp.get(s.app_id) ?? []}
                  />
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Sidebar */}
        <aside style={{ position: 'sticky', top: 80 }}>

          {/* Steam Top 10 */}
          <div style={{
            background: 'var(--bg-elev)', border: '1px solid var(--line)',
            borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 20,
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
              <span className="gs-section-label" style={{ marginBottom: 4 }}>MOST PLAYED NOW</span>
              <h3 style={{ fontSize: 17, letterSpacing: '-0.02em', fontWeight: 500, margin: 0 }}>Steam Top 10</h3>
            </div>
            {topGames.length === 0 ? (
              <div style={{ padding: '24px 20px', fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)' }}>
                데이터 미수신
              </div>
            ) : (
              <div>
                {topGames.slice(0, 10).map((g, i) => (
                  <Link
                    key={g.app_id}
                    href={`https://store.steampowered.com/app/${g.app_id}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 20px',
                      borderBottom: i < 9 ? '1px solid var(--line)' : 'none',
                      textDecoration: 'none',
                      transition: 'background .1s',
                    }}
                    className="gs-top-row"
                  >
                    <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-4)', width: 24, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {isGameTemp(g.title) ? `app ${g.app_id}` : g.title}
                    </span>
                    <span style={{ fontFamily: 'var(--t-mono)', fontSize: 11, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {fmtK(g.concurrent_users)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Tier guide */}
          <div style={{
            background: 'var(--bg-elev)', border: '1px solid var(--line)',
            borderRadius: 'var(--r)', padding: '16px 20px',
          }}>
            <span className="gs-section-label">READING THE SIGNAL</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {tierGuide.map(t => (
                <div key={t.priority} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{
                    flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
                    padding: '3px 8px', borderRadius: 999,
                    background: t.bg, color: t.fg,
                    fontFamily: 'var(--t-mono)',
                  }}>
                    {t.priority}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45, paddingTop: 2 }}>
                    {t.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
