'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  total_clips: number;
  total_days: number;
  total_forecasts: number;
  total_threads: number;
  pending_suggestions: number;
  last_clip_date: string;
  upcoming_schedules: number;
}

function BlinkCursor() {
  return <span className="gs-blink">█</span>;
}

function StatCard({ label, value, unit, accent = false }: {
  label: string; value: string | number; unit?: string; accent?: boolean;
}) {
  return (
    <div className="gs-stat-card">
      <div className="gs-stat-label">{label}</div>
      <div className={`gs-stat-value${accent ? ' gs-accent' : ''}`}>
        {value}
        {unit && <span className="gs-stat-unit"> {unit}</span>}
      </div>
    </div>
  );
}

export default function AboutPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/about-stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <>
      <style>{`
        .gs-about {
          max-width: 960px;
          margin: 0 auto;
          padding: 48px 24px 80px;
          font-family: 'IBM Plex Mono', monospace;
          color: #e6edf3;
        }

        /* HEADER */
        .gs-breadcrumb {
          font-size: 11px;
          color: #8b949e;
          letter-spacing: .12em;
          margin-bottom: 20px;
        }
        .gs-breadcrumb a { color: #58a6ff; text-decoration: none; }
        .gs-breadcrumb a:hover { text-decoration: underline; }
        .gs-eyebrow {
          font-size: 11px;
          color: #00ff87;
          letter-spacing: .2em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }
        .gs-headline {
          font-family: 'Inter Tight', sans-serif;
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 700;
          line-height: 1.15;
          margin-bottom: 16px;
        }
        .gs-headline-accent { color: #00ff87; }
        .gs-blink {
          color: #00ff87;
          animation: gs-blink 1s step-end infinite;
        }
        @keyframes gs-blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .gs-lead {
          font-size: 13px;
          color: #8b949e;
          line-height: 1.75;
          max-width: 580px;
          border-bottom: 1px solid #30363d;
          padding-bottom: 32px;
          margin-bottom: 48px;
        }

        /* SECTION HEADER */
        .gs-section { margin-bottom: 48px; }
        .gs-section-head {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }
        .gs-section-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #00ff87;
          flex-shrink: 0;
        }
        .gs-section-dot.blue { background: #58a6ff; }
        .gs-section-dot.warn { background: #f0a000; }
        .gs-section-title {
          font-size: 11px;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: #8b949e;
        }
        .gs-section-rule {
          flex: 1;
          height: 1px;
          background: #30363d;
        }

        /* STATS GRID */
        .gs-stats {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 1px;
          background: #30363d;
          border: 1px solid #30363d;
        }
        .gs-stat-card {
          background: #161b22;
          padding: 20px 16px;
          transition: background .15s;
        }
        .gs-stat-card:hover { background: #1c2128; }
        .gs-stat-label {
          font-size: 10px;
          letter-spacing: .14em;
          color: #8b949e;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .gs-stat-value {
          font-size: 28px;
          font-weight: 700;
          font-family: 'Inter Tight', sans-serif;
          color: #e6edf3;
          line-height: 1;
        }
        .gs-stat-value.gs-accent { color: #00ff87; }
        .gs-stat-unit {
          font-size: 12px;
          color: #8b949e;
          font-weight: 400;
          font-family: 'IBM Plex Mono', monospace;
        }

        /* FEATURE CARDS */
        .gs-features {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
        .gs-feature {
          border: 1px solid #30363d;
          background: #161b22;
          padding: 24px;
          transition: border-color .15s, background .15s;
        }
        .gs-feature:hover { border-color: #58a6ff; background: #1c2128; }
        .gs-feature-tag {
          font-size: 10px;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: #00ff87;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .gs-feature-tag::before {
          content: '';
          display: inline-block;
          width: 4px; height: 4px;
          border-radius: 50%;
          background: currentColor;
        }
        .gs-feature-tag.blue { color: #58a6ff; }
        .gs-feature-tag.warn { color: #f0a000; }
        .gs-feature-title {
          font-family: 'Inter Tight', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #e6edf3;
          margin-bottom: 8px;
        }
        .gs-feature-desc {
          font-size: 12px;
          color: #8b949e;
          line-height: 1.7;
        }
        .gs-feature-link {
          display: inline-block;
          margin-top: 16px;
          font-size: 11px;
          color: #58a6ff;
          text-decoration: none;
          letter-spacing: .06em;
        }
        .gs-feature-link:hover { text-decoration: underline; }
        .gs-feature-link::after { content: ' →'; }

        /* PIPELINE */
        .gs-pipeline { display: flex; flex-direction: column; gap: 8px; }
        .gs-pipe-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          border: 1px solid #30363d;
          background: #161b22;
          font-size: 12px;
        }
        .gs-pipe-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #00ff87;
          flex-shrink: 0;
          box-shadow: 0 0 6px #00ff87;
          animation: gs-pulse 2.2s ease-in-out infinite;
        }
        @keyframes gs-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .gs-pipe-name { color: #e6edf3; letter-spacing: .06em; flex: 1; }
        .gs-pipe-detail { color: #8b949e; font-size: 11px; }

        /* DATA SOURCES */
        .gs-sources {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }
        .gs-source {
          border: 1px solid #30363d;
          background: #161b22;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          color: #e6edf3;
          transition: border-color .15s;
        }
        .gs-source:hover { border-color: #30363d; }
        .gs-source-icon {
          width: 22px; height: 22px;
          border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: 700; flex-shrink: 0;
        }
        .gs-si-steam    { background: #1b2838; color: #c7d5e0; }
        .gs-si-inven    { background: #ff6b35; color: #fff; }
        .gs-si-neon     { background: #00e7a0; color: #000; }
        .gs-si-supabase { background: #3ecf8e; color: #000; }
        .gs-si-vercel   { background: #111; color: #fff; border: 1px solid #30363d; }
        .gs-si-github   { background: #24292e; color: #fff; }
        .gs-source-name { flex: 1; }
        .gs-source-badge { font-size: 10px; color: #00ff87; letter-spacing: .06em; }

        /* SYSINFO */
        .gs-sysinfo {
          border: 1px solid #30363d;
          background: #161b22;
          padding: 20px 20px 4px;
          font-size: 12px;
          line-height: 1;
        }
        .gs-sysrow {
          display: flex;
          gap: 16px;
          padding: 10px 0;
          border-bottom: 1px solid #21262d;
        }
        .gs-sysrow:last-child { border-bottom: none; }
        .gs-syskey { color: #58a6ff; min-width: 190px; flex-shrink: 0; }
        .gs-sysval { color: #e6edf3; }
        .gs-sysval.ok { color: #00ff87; }

        /* BACK */
        .gs-back {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #8b949e;
          text-decoration: none;
          margin-top: 48px;
          padding: 10px 16px;
          border: 1px solid #30363d;
          transition: color .15s, border-color .15s;
        }
        .gs-back:hover { color: #00ff87; border-color: #00ff87; }

        @media (max-width: 600px) {
          .gs-stats { grid-template-columns: repeat(2, 1fr); }
          .gs-features { grid-template-columns: 1fr; }
          .gs-sources { grid-template-columns: repeat(2, 1fr); }
          .gs-syskey { min-width: 130px; }
        }
      `}</style>

      <div className="gs-about">

        {/* ── HEADER ── */}
        <div className="gs-breadcrumb">
          <Link href="/">GAMESIGNAL</Link> / ABOUT
        </div>
        <div className="gs-eyebrow">SYSTEM INFO</div>
        <h1 className="gs-headline">
          게임 시장의 신호를<br />
          <span className="gs-headline-accent">읽는다</span>
          <BlinkCursor />
        </h1>
        <p className="gs-lead">
          GameSignal은 Steam 트래픽 모니터링, 인벤 뉴스 클리핑,
          게임 판매량 예측을 통합한 게임 인더스트리 인텔리전스 대시보드입니다.
          매일 KST 06:00 자동 수집 파이프라인이 실행되며,
          VC·증권사 애널리스트 관점의 분석을 제공합니다.
        </p>

        {/* ── COVERAGE ── */}
        <div className="gs-section">
          <div className="gs-section-head">
            <span className="gs-section-dot" />
            <span className="gs-section-title">Coverage</span>
            <span className="gs-section-rule" />
          </div>
          <div className="gs-stats">
            <StatCard
              label="뉴스 클립 누적"
              value={stats ? Number(stats.total_clips) : '—'}
              unit="건" accent
            />
            <StatCard
              label="클리핑 일수"
              value={stats ? Number(stats.total_days) : '—'}
              unit="일"
            />
            <StatCard
              label="판매량 예측"
              value={stats ? Number(stats.total_forecasts) : '—'}
              unit="종"
            />
            <StatCard
              label="예측 스레드"
              value={stats ? Number(stats.total_threads) : '—'}
              unit="건"
            />
            <StatCard
              label="오케스트레이터 제안"
              value={stats ? Number(stats.pending_suggestions) : '—'}
              unit="pending"
            />
            <StatCard
              label="예정 스케줄"
              value={stats ? Number(stats.upcoming_schedules) : '—'}
              unit="건"
            />
          </div>
        </div>

        {/* ── FEATURES ── */}
        <div className="gs-section">
          <div className="gs-section-head">
            <span className="gs-section-dot blue" />
            <span className="gs-section-title">Features</span>
            <span className="gs-section-rule" />
          </div>
          <div className="gs-features">
            <div className="gs-feature">
              <div className="gs-feature-tag">Dashboard</div>
              <div className="gs-feature-title">Signal Feed</div>
              <div className="gs-feature-desc">
                Steam 위시리스트·Most Played 순위 변동을 실시간으로 감지합니다.
                CCU 추이, Steam Top 10, 파이프라인 상태를 한눈에 확인하세요.
              </div>
              <Link href="/" className="gs-feature-link">대시보드 바로가기</Link>
            </div>
            <div className="gs-feature">
              <div className="gs-feature-tag blue">News</div>
              <div className="gs-feature-title">인벤 뉴스 클리핑</div>
              <div className="gs-feature-desc">
                인벤 게임 뉴스를 매일 수집·분석합니다.
                VC·증권사 애널리스트 관점의 코멘트와 관련 티커가 자동으로 태깅됩니다.
              </div>
              <Link href="/news" className="gs-feature-link">뉴스 페이지 바로가기</Link>
            </div>
            <div className="gs-feature">
              <div className="gs-feature-tag warn">Forecasting</div>
              <div className="gs-feature-title">판매량 예측</div>
              <div className="gs-feature-desc">
                Bear·Base·Bull 3시나리오로 게임 판매량을 예측합니다.
                출시 후 실측 데이터를 반영해 스레드 방식으로 예측을 업데이트합니다.
              </div>
              <Link href="/forecasting" className="gs-feature-link">예측 페이지 바로가기</Link>
            </div>
          </div>
        </div>

        {/* ── PIPELINE ── */}
        <div className="gs-section">
          <div className="gs-section-head">
            <span className="gs-section-dot" />
            <span className="gs-section-title">Pipeline</span>
            <span className="gs-section-rule" />
          </div>
          <div className="gs-pipeline">
            {[
              { name: 'SIGNAL_ENGINE',   detail: 'GitHub Actions · 매일 KST 06:00 자동 수집' },
              { name: 'NEWS_CLIPPER',    detail: 'save-news v4 · Supabase Edge Function' },
              { name: 'ORCHESTRATOR',    detail: '뉴스 → 예측 제안 자동 생성 · forecast_suggestions' },
              { name: 'FORECAST_ENGINE', detail: 'Game Sales Predictor v1.1 · 수동 + 자동 업데이트' },
            ].map(p => (
              <div key={p.name} className="gs-pipe-item">
                <span className="gs-pipe-dot" />
                <span className="gs-pipe-name">{p.name}</span>
                <span className="gs-pipe-detail">{p.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── DATA SOURCES ── */}
        <div className="gs-section">
          <div className="gs-section-head">
            <span className="gs-section-dot blue" />
            <span className="gs-section-title">Data Sources</span>
            <span className="gs-section-rule" />
          </div>
          <div className="gs-sources">
            {[
              { icon: 'gs-si-steam',    label: 'St', name: 'Steam API',          badge: 'LIVE' },
              { icon: 'gs-si-inven',    label: 'In', name: '인벤 (inven.co.kr)', badge: 'DAILY' },
              { icon: 'gs-si-neon',     label: 'N',  name: 'Neon DB',            badge: 'PRIMARY' },
              { icon: 'gs-si-supabase', label: 'Sb', name: 'Supabase',           badge: 'EDGE' },
              { icon: 'gs-si-vercel',   label: '▲',  name: 'Vercel',             badge: 'DEPLOY' },
              { icon: 'gs-si-github',   label: 'Gh', name: 'GitHub Actions',     badge: 'CI/CD' },
            ].map(s => (
              <div key={s.name} className="gs-source">
                <span className={`gs-source-icon ${s.icon}`}>{s.label}</span>
                <span className="gs-source-name">{s.name}</span>
                <span className="gs-source-badge">{s.badge}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── SYSTEM ── */}
        <div className="gs-section">
          <div className="gs-section-head">
            <span className="gs-section-dot warn" />
            <span className="gs-section-title">System</span>
            <span className="gs-section-rule" />
          </div>
          <div className="gs-sysinfo">
            {[
              { k: 'VERSION',         v: 'GameSignal MVP v1.0' },
              { k: 'FRAMEWORK',       v: 'Next.js 14 + Tailwind CSS' },
              { k: 'FORECAST_MODEL',  v: 'Game Sales Predictor v1.1' },
              { k: 'BUILD_DATE',      v: '2026-03-01' },
              { k: 'LAST_CLIP_DATE',  v: stats?.last_clip_date ?? (mounted ? new Date().toISOString().split('T')[0] : '—') },
              { k: 'PIPELINE_STATUS', v: '● OPERATIONAL', ok: true },
              { k: 'REPOSITORY',      v: 'github.com/hyunary/gamesignal' },
            ].map(row => (
              <div key={row.k} className="gs-sysrow">
                <span className="gs-syskey">{row.k}</span>
                <span className={`gs-sysval${row.ok ? ' ok' : ''}`}>{row.v}</span>
              </div>
            ))}
          </div>
        </div>

        <Link href="/" className="gs-back">← DASHBOARD로 돌아가기</Link>

      </div>
    </>
  );
}
