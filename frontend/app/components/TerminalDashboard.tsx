/**
 * app/components/TerminalDashboard.tsx — NoiseCatcher
 *
 * 반응형 수정 4개 적용:
 *  [수정 1] KPI strip     4열 → 모바일 2열
 *  [수정 2] Filter toolbar wrap 처리 + 버튼 텍스트 모바일 단축
 *  [수정 3] Signal card grid  auto-fill → 모바일 1열
 *  [수정 4] 하단 차트+Top10  2열 → 모바일 1열
 *
 * 인라인 style 유지 대상:
 *  - tierFg, tierBg 등 동적 색상 값
 *  - barWidth 등 JS 계산 퍼센트 값
 *  CSS 변수 --line / --bg-elev / --ink 유지
 */

"use client";

import { useState, useMemo } from "react";

/* ── 타입 ──────────────────────────────────────────────────────── */

type Tier = "P0" | "P1" | "P2";

interface Signal {
  id: string;
  gameTitle: string;
  developer: string;
  tier: Tier;
  signalType: string;
  insight: string;
  ccu: number;
  ccuDelta: number;
  wishlistRank: number | null;
  collectedAt: string;
  headerImageUrl: string;
  youtubeUrl: string | null;
}

/* ── 상수 ──────────────────────────────────────────────────────── */

const TIER_META: Record<Tier, { fg: string; bg: string; label: string }> = {
  P0: { fg: "#dc2626", bg: "#fef2f2", label: "P0" },
  P1: { fg: "#d97706", bg: "#fffbeb", label: "P1" },
  P2: { fg: "#6b7280", bg: "#f9fafb", label: "P2" },
};

const FILTER_OPTIONS: { key: Tier | "ALL"; fullLabel: string; shortLabel: string }[] = [
  { key: "ALL", fullLabel: "전체",                   shortLabel: "ALL" },
  { key: "P0",  fullLabel: "Most Played Top 100 진입", shortLabel: "P0"  },
  { key: "P1",  fullLabel: "Wishlist 급등",            shortLabel: "P1"  },
  { key: "P2",  fullLabel: "리뷰 급증",               shortLabel: "P2"  },
];

/* ── 목 데이터 ─────────────────────────────────────────────────── */

const MOCK_SIGNALS: Signal[] = [
  {
    id: "sig-001",
    gameTitle: "Hollow Knight: Silksong",
    developer: "Team Cherry",
    tier: "P0",
    signalType: "new_entry_mp",
    insight: "72시간 전 커뮤니티 노이즈 급등 후 Top 100 진입. 출시 임박 신호.",
    ccu: 284_502,
    ccuDelta: 18.4,
    wishlistRank: 3,
    collectedAt: "2025-05-15T06:00:00Z",
    headerImageUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1030300/header.jpg",
    youtubeUrl: "https://youtube.com/watch?v=example",
  },
  {
    id: "sig-002",
    gameTitle: "Hades II",
    developer: "Supergiant Games",
    tier: "P1",
    signalType: "wishlist_surge",
    insight: "얼리 액세스 발표 후 위시리스트 순위 12단계 상승.",
    ccu: 91_204,
    ccuDelta: 34.2,
    wishlistRank: 7,
    collectedAt: "2025-05-15T06:00:00Z",
    headerImageUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1145350/header.jpg",
    youtubeUrl: null,
  },
  {
    id: "sig-003",
    gameTitle: "Manor Lords",
    developer: "Slavic Magic",
    tier: "P0",
    signalType: "traffic_revival",
    insight: "패치 이후 45일 공백 깨고 CCU 89% 반등. 대형 업데이트 선행 패턴.",
    ccu: 172_890,
    ccuDelta: 89.1,
    wishlistRank: null,
    collectedAt: "2025-05-15T06:00:00Z",
    headerImageUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/1363080/header.jpg",
    youtubeUrl: "https://youtube.com/watch?v=example2",
  },
  {
    id: "sig-004",
    gameTitle: "Balatro",
    developer: "LocalThunk",
    tier: "P2",
    signalType: "review_spike",
    insight: "30일 리뷰 21% 증가, 긍정률 97% 유지. 입소문 확산 중.",
    ccu: 44_120,
    ccuDelta: 6.7,
    wishlistRank: 22,
    collectedAt: "2025-05-15T06:00:00Z",
    headerImageUrl: "https://cdn.cloudflare.steamstatic.com/steam/apps/2379780/header.jpg",
    youtubeUrl: null,
  },
];

const TOP_GAMES = [
  { title: "Hollow Knight: Silksong", ccu: 284_502, pct: 100 },
  { title: "Manor Lords",             ccu: 172_890, pct: 61  },
  { title: "Hades II",                ccu: 91_204,  pct: 32  },
  { title: "Balatro",                 ccu: 44_120,  pct: 16  },
  { title: "Palworld",                ccu: 38_900,  pct: 14  },
];

/* ── KST 변환 ──────────────────────────────────────────────────── */
function toKST(utc: string) {
  const d = new Date(new Date(utc).getTime() + 9 * 3600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} KST`;
}

/* ══════════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════════ */

export default function TerminalDashboard() {
  const [filter, setFilter] = useState<Tier | "ALL">("ALL");

  const filtered = useMemo(
    () => (filter === "ALL" ? MOCK_SIGNALS : MOCK_SIGNALS.filter((s) => s.tier === filter)),
    [filter],
  );

  const kpis = [
    { label: "탐지 신호",   value: String(MOCK_SIGNALS.length) },
    { label: "P0 신호",     value: String(MOCK_SIGNALS.filter((s) => s.tier === "P0").length) },
    { label: "추적 게임",   value: "4,218" },
    { label: "평균 선행",   value: "72h"   },
  ];

  /* ── render ─────────────────────────────────────────────────── */
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-12">

      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-[18px] sm:text-[22px] font-semibold tracking-tight"
            style={{ color: "var(--ink)" }}>
            신호 대시보드
          </h1>
          <p className="text-[12px] sm:text-[13px] mt-0.5"
            style={{ color: "var(--ink)", opacity: 0.45 }}>
            NoiseCatcher · 실시간 게임 트래픽 신호
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px]"
          style={{ color: "var(--ink)", opacity: 0.4 }}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* ════════════════════════════════════════════════════════
          [수정 1] KPI strip — 4열 → 모바일 2열
          before: style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}
          after : grid-cols-2 sm:grid-cols-4

          구분선:
          · 세로: 모바일 홀수 우측 → [&:not(:nth-child(2n))]:border-r
                  sm: 마지막 제외  → sm:[&:not(:last-child)]:border-r
          · 가로: 모바일 상단 2개  → border-b [&:nth-child(n+3)]:border-b-0
                  sm: 제거         → sm:border-b-0
      ════════════════════════════════════════════════════════ */}
      <section
        className="
          grid grid-cols-2 sm:grid-cols-4
          border border-[var(--line)] rounded-[10px]
          bg-[var(--bg-elev)] overflow-hidden
          mb-9
        "
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="
              p-4 sm:p-[18px_22px]
              [&:not(:nth-child(2n))]:border-r sm:[&:not(:last-child)]:border-r
              border-[var(--line)]
              border-b [&:nth-child(n+3)]:border-b-0 sm:border-b-0
            "
          >
            <p className="text-[22px] sm:text-[28px] font-semibold leading-none
                tracking-[-0.03em] mb-1 tabular-nums"
              style={{ color: "var(--ink)" }}>
              {kpi.value}
            </p>
            <p className="text-[11px] sm:text-[12px]"
              style={{ color: "var(--ink)", opacity: 0.4 }}>
              {kpi.label}
            </p>
          </div>
        ))}
      </section>

      {/* ════════════════════════════════════════════════════════
          [수정 2] Filter toolbar — 모바일 wrap 처리
          before: style={{ display:'flex', alignItems:'center' }}
          after : flex flex-wrap items-center gap-y-2

          버튼 텍스트: 모바일 단축 (span 두 개)
          카운트 텍스트: 모바일 hidden
      ════════════════════════════════════════════════════════ */}
      <div
        className="
          flex flex-wrap items-center gap-y-2
          py-[14px] border-t border-b border-[var(--line)]
          mb-7
        "
      >
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className="
                  text-[11px] sm:text-[12px] px-2.5 sm:px-3 py-1.5 rounded-full
                  border transition-colors duration-150
                "
                style={{
                  borderColor: active ? "var(--ink)" : "var(--line)",
                  background: active ? "var(--ink)" : "transparent",
                  color: active ? "var(--bg-elev)" : "var(--ink)",
                  opacity: active ? 1 : 0.55,
                }}
              >
                {/* 모바일: shortLabel / sm 이상: fullLabel */}
                <span className="hidden sm:inline">{opt.fullLabel}</span>
                <span className="sm:hidden">{opt.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* 카운트 — 모바일에서 숨김 */}
        <span
          className="hidden sm:inline text-[11px] sm:text-[12px] tabular-nums ml-auto"
          style={{ color: "var(--ink)", opacity: 0.35 }}
        >
          {filtered.length} signals · {TOP_GAMES.length} games tracked
        </span>
      </div>

      {/* ════════════════════════════════════════════════════════
          [수정 3] Signal card grid — 모바일 1열
          before: style={{ display:'grid',
                    gridTemplateColumns:'repeat(auto-fill, minmax(360px,1fr))' }}
          after : grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]
      ════════════════════════════════════════════════════════ */}
      <div
        className="
          grid grid-cols-1
          sm:grid-cols-[repeat(auto-fill,minmax(360px,1fr))]
          gap-[18px] mt-3
          mb-10
        "
      >
        {filtered.map((sig) => {
          const meta = TIER_META[sig.tier];
          return (
            <article
              key={sig.id}
              className="
                rounded-[10px] border border-[var(--line)]
                bg-[var(--bg-elev)] overflow-hidden
                hover:shadow-md transition-shadow duration-150
              "
            >
              {/* 헤더 이미지 */}
              <div className="h-[120px] sm:h-[130px] overflow-hidden bg-slate-100">
                <img
                  src={sig.headerImageUrl}
                  alt={sig.gameTitle}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="p-4 sm:p-5">
                {/* 뱃지 + 제목 */}
                <div className="flex items-start gap-2 mb-3">
                  <span
                    className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                    style={{ color: meta.fg, background: meta.bg }}
                  >
                    {meta.label}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium leading-snug truncate"
                      style={{ color: "var(--ink)" }}>
                      {sig.gameTitle}
                    </p>
                    <p className="text-[11px] mt-0.5 truncate"
                      style={{ color: "var(--ink)", opacity: 0.45 }}>
                      {sig.developer}
                    </p>
                  </div>
                </div>

                {/* Insight */}
                <p className="text-[12px] sm:text-[13px] leading-[1.7] mb-4"
                  style={{ color: "var(--ink)", opacity: 0.6 }}>
                  {sig.insight}
                </p>

                {/* 수치 */}
                <div className="flex gap-4 text-[11px] sm:text-[12px] mb-4"
                  style={{ color: "var(--ink)", opacity: 0.5 }}>
                  <span>
                    CCU{" "}
                    <span className="font-medium tabular-nums"
                      style={{ color: "var(--ink)", opacity: 1 }}>
                      {sig.ccu.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    <span className="font-medium tabular-nums text-emerald-500">
                      +{sig.ccuDelta}%
                    </span>
                  </span>
                  {sig.wishlistRank && (
                    <span>WL #{sig.wishlistRank}</span>
                  )}
                </div>

                {/* 링크 + 시각 */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <a
                      href={`https://store.steampowered.com/app/${sig.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] px-2.5 py-1.5 rounded-lg border border-[var(--line)]
                        hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                      style={{ color: "var(--ink)", opacity: 0.6 }}
                    >
                      Steam
                    </a>
                    {sig.youtubeUrl && (
                      <a
                        href={sig.youtubeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-red-200
                          text-red-500 hover:bg-red-50 transition-colors"
                      >
                        트레일러
                      </a>
                    )}
                  </div>
                  <time className="text-[10px] tabular-nums"
                    style={{ color: "var(--ink)", opacity: 0.3 }}>
                    {toKST(sig.collectedAt)}
                  </time>
                </div>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-[13px]"
            style={{ color: "var(--ink)", opacity: 0.35 }}>
            해당 조건의 신호가 없습니다.
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          [수정 4] 하단 차트 + Top10 — 2열 → 모바일 1열
          before: style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:20 }}
          after : grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-5
      ════════════════════════════════════════════════════════ */}
      <section className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr] gap-5">

        {/* 왼쪽: CCU 트렌드 차트 영역 */}
        <div
          className="rounded-[10px] border border-[var(--line)] bg-[var(--bg-elev)] p-5 sm:p-6"
        >
          <p className="text-[11px] uppercase tracking-[0.1em] font-medium mb-4"
            style={{ color: "var(--ink)", opacity: 0.4 }}>
            CCU 트렌드 (7일)
          </p>

          {/* 차트 플레이스홀더 — 실제 구현 시 Recharts LineChart 삽입 */}
          <div
            className="h-[180px] sm:h-[200px] rounded-lg flex items-center justify-center"
            style={{ background: "var(--line)", opacity: 0.3 }}
          >
            <span className="text-[12px]" style={{ color: "var(--ink)", opacity: 0.6 }}>
              LineChart — Recharts 연동 지점
            </span>
          </div>

          <p className="text-[11px] mt-3 tabular-nums"
            style={{ color: "var(--ink)", opacity: 0.35 }}>
            최근 7일 · 상위 5개 게임
          </p>
        </div>

        {/* 오른쪽: Top 게임 랭킹 */}
        <div
          className="rounded-[10px] border border-[var(--line)] bg-[var(--bg-elev)] p-5 sm:p-6"
        >
          <p className="text-[11px] uppercase tracking-[0.1em] font-medium mb-4"
            style={{ color: "var(--ink)", opacity: 0.4 }}>
            Top 게임 (CCU 기준)
          </p>

          <div className="space-y-3">
            {TOP_GAMES.map((g, idx) => (
              <div key={g.title} className="flex items-center gap-3">
                {/* 순위 */}
                <span
                  className="w-5 text-[11px] text-right shrink-0 tabular-nums"
                  style={{ color: "var(--ink)", opacity: 0.3 }}
                >
                  {idx + 1}
                </span>

                {/* 게임명 + 바 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] truncate"
                      style={{ color: "var(--ink)", opacity: 0.8 }}>
                      {g.title}
                    </span>
                    <span className="text-[11px] tabular-nums ml-2 shrink-0"
                      style={{ color: "var(--ink)", opacity: 0.45 }}>
                      {g.ccu.toLocaleString()}
                    </span>
                  </div>
                  <div
                    className="h-[3px] rounded-full overflow-hidden"
                    style={{ background: "var(--line)" }}
                  >
                    {/* barWidth: JS 계산값이므로 인라인 style 유지 */}
                    <div
                      className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all"
                      style={{ width: `${g.pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
