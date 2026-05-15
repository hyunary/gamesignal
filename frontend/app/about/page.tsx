/**
 * app/about/page.tsx — NoiseCatcher
 *
 * 반응형 수정 6개 적용:
 *  [수정 1] Hero h1       style fontSize:64 → text-[40px] sm:text-[64px]
 *  [수정 2] Stats strip   4열 → 모바일 2열
 *  [수정 3] Principles    3열 → 모바일 1열
 *  [수정 4] Timeline      2단 → 모바일 1단 + 내부 행 열 너비 축소
 *  [수정 5] Pipeline      2열 → 모바일 1열
 *  [수정 6] CTA 패딩      p-8 → sm:p-[56px_48px]
 *
 * CSS 변수 --line / --bg-elev / --ink 유지
 */

export default function AboutPage() {
  /* ── 데이터 ─────────────────────────────────────────────────── */
  const stats = [
    { value: "4,200+", label: "추적 게임 수" },
    { value: "98%",    label: "신호 정확도" },
    { value: "72h",    label: "평균 선행 시간" },
    { value: "340+",   label: "누적 사용자" },
  ];

  const principles = [
    {
      no: "01",
      title: "노이즈는 정보다",
      body: "커뮤니티 노이즈, 검색 트렌드, 리뷰 패턴 — 대부분이 걸러내는 것들 안에 신호가 있습니다.",
    },
    {
      no: "02",
      title: "타이밍이 전부다",
      body: "신호는 늦으면 의미가 없습니다. 급등 전 72시간, 그 창을 잡는 것이 NoiseCatcher의 존재 이유입니다.",
    },
    {
      no: "03",
      title: "데이터는 단순해야 한다",
      body: "복잡한 분석보다 명확한 한 줄의 신호가 더 가치 있습니다. 노이즈는 우리가 처리합니다.",
    },
  ];

  const timeline = [
    {
      date: "2024 Q1",
      title: "첫 번째 신호 포착",
      desc: "스팀 Most Played 데이터를 처음 수집하고 패턴을 발견했습니다.",
    },
    {
      date: "2024 Q2",
      title: "알고리즘 v1 완성",
      desc: "커뮤니티·검색·리뷰 노이즈를 통합한 첫 신호 엔진을 완성했습니다.",
    },
    {
      date: "2024 Q3",
      title: "베타 사용자 50명",
      desc: "첫 베타 그룹과 함께 신호 정확도를 검증하고 피드백을 수집했습니다.",
    },
    {
      date: "2025 Q1",
      title: "NoiseCatcher 공식 런칭",
      desc: "서비스를 공개하고 지인 네트워크부터 확산을 시작했습니다.",
    },
  ];

  const pipeline = [
    {
      step: "01",
      title: "데이터 수집",
      desc: "스팀 차트·커뮤니티·검색 트렌드를 매일 자동 수집합니다.",
      tag: "Steam API · SteamSpy · 검색 노이즈",
    },
    {
      step: "02",
      title: "노이즈 필터링",
      desc: "일시적 스파이크와 실제 상승 신호를 알고리즘으로 분리합니다.",
      tag: "ALGO-SPEC-001 v1.1 기반",
    },
    {
      step: "03",
      title: "신호 생성",
      desc: "5종 신호 유형으로 분류하고 등급을 부여합니다.",
      tag: "P0 / P1 우선순위 체계",
    },
    {
      step: "04",
      title: "리포트 전달",
      desc: "매주 확정 신호를 구독자에게 이메일로 발송합니다.",
      tag: "Daily Digest · 즉시 발송 선택",
    },
  ];

  return (
    <main className="max-w-[1080px] mx-auto px-5 sm:px-8 py-16 sm:py-24">

      {/* ══════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════ */}
      <section className="mb-16 sm:mb-[72px]">
        {/*
          [수정 1] Hero h1 폰트 크기
          before: style={{ fontSize: 64, lineHeight: 0.95, ... }}
          after : className 으로 전환, style 속성 제거
        */}
        <h1
          className="text-[40px] sm:text-[64px] leading-[0.95] tracking-[-0.04em] font-medium mb-6"
          style={{ color: "var(--ink)" }}
        >
          노이즈 속에서
          <br />
          진짜 신호를 건집니다.
        </h1>

        <p
          className="text-[16px] sm:text-[18px] leading-[1.7] max-w-[560px]"
          style={{ color: "var(--ink)", opacity: 0.55 }}
        >
          NoiseCatcher는 스팀·커뮤니티·검색 데이터를 분석해
          게임 트래픽이 급등하기 전 신호를 포착합니다.
        </p>
      </section>

      {/* ══════════════════════════════════════════════════════
          [수정 2] Stats strip — 4열 → 모바일 2열
          before: style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}
          after : grid-cols-2 sm:grid-cols-4

          구분선 규칙
          · 가로선: 모바일 1·2번 항목(상단행) 하단에만 → [&:nth-child(-n+2)]:border-b
                   sm에서 모두 제거 → sm:[&:nth-child(-n+2)]:border-b-0
          · 세로선: 모바일 홀수 항목 우측 → [&:not(:nth-child(2n))]:border-r
                   sm: 마지막 제외 → sm:[&:not(:last-child)]:border-r
      ══════════════════════════════════════════════════════ */}
      <section
        className="
          grid grid-cols-2 sm:grid-cols-4
          border border-[var(--line)] rounded-[10px]
          bg-[var(--bg-elev)] overflow-hidden
          mb-[72px]
        "
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="
              p-5 sm:p-[28px_24px]
              border-b border-[var(--line)] sm:border-b-0
              [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0
              [&:not(:nth-child(2n))]:border-r sm:[&:not(:last-child)]:border-r
              border-[var(--line)]
            "
          >
            <p
              className="text-[26px] sm:text-[34px] font-semibold leading-none tracking-[-0.03em] mb-1.5"
              style={{ color: "var(--ink)" }}
            >
              {stat.value}
            </p>
            <p
              className="text-[11px] sm:text-[13px] leading-snug"
              style={{ color: "var(--ink)", opacity: 0.45 }}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </section>

      {/* ══════════════════════════════════════════════════════
          [수정 3] Principles — 3열 → 모바일 1열
          before: style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:20 }}
          after : grid-cols-1 sm:grid-cols-3 gap-5
      ══════════════════════════════════════════════════════ */}
      <section className="mb-[72px]">
        <h2
          className="text-[11px] uppercase tracking-[0.12em] font-medium mb-8"
          style={{ color: "var(--ink)", opacity: 0.4 }}
        >
          원칙
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {principles.map((p) => (
            <div
              key={p.no}
              className="p-6 rounded-[10px] border border-[var(--line)] bg-[var(--bg-elev)]"
            >
              <span
                className="block text-[11px] font-medium mb-4 tabular-nums"
                style={{ color: "var(--ink)", opacity: 0.3 }}
              >
                {p.no}
              </span>
              <h3
                className="text-[15px] font-medium leading-snug mb-2.5"
                style={{ color: "var(--ink)" }}
              >
                {p.title}
              </h3>
              <p
                className="text-[13px] leading-[1.75]"
                style={{ color: "var(--ink)", opacity: 0.55 }}
              >
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          [수정 4] Timeline — 2단 → 모바일 1단
          before: style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:64 }}
          after : grid-cols-1 sm:grid-cols-[1fr_1.6fr] gap-8 sm:gap-16

          내부 행
          before: style={{ display:'grid', gridTemplateColumns:'120px 1fr', gap:32 }}
          after : grid-cols-[80px_1fr] sm:grid-cols-[120px_1fr] gap-4 sm:gap-8
      ══════════════════════════════════════════════════════ */}
      <section
        className="
          grid grid-cols-1 sm:grid-cols-[1fr_1.6fr]
          gap-8 sm:gap-16 items-start
          mb-[72px]
        "
      >
        {/* 왼쪽: sticky 제목 */}
        <div className="sm:sticky sm:top-24">
          <h2
            className="text-[11px] uppercase tracking-[0.12em] font-medium mb-3"
            style={{ color: "var(--ink)", opacity: 0.4 }}
          >
            타임라인
          </h2>
          <p
            className="text-[15px] leading-[1.7]"
            style={{ color: "var(--ink)", opacity: 0.6 }}
          >
            사이드 프로젝트로 시작해
            <br className="hidden sm:block" />
            실제로 작동하는 걸 확인했습니다.
          </p>
        </div>

        {/* 오른쪽: 행 목록 */}
        <div>
          {timeline.map((item) => (
            <div
              key={item.date}
              className="
                grid grid-cols-[80px_1fr] sm:grid-cols-[120px_1fr]
                gap-4 sm:gap-8 py-[22px]
                border-b border-[var(--line)] last:border-b-0
              "
            >
              <span
                className="text-[12px] sm:text-[13px] tabular-nums pt-0.5 shrink-0"
                style={{ color: "var(--ink)", opacity: 0.35 }}
              >
                {item.date}
              </span>
              <div>
                <p
                  className="text-[14px] sm:text-[15px] font-medium leading-snug mb-1"
                  style={{ color: "var(--ink)" }}
                >
                  {item.title}
                </p>
                <p
                  className="text-[13px] leading-[1.7]"
                  style={{ color: "var(--ink)", opacity: 0.55 }}
                >
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          [수정 5] Pipeline — 2열 → 모바일 1열
          before: style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)' }}
          after : grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--line)]
      ══════════════════════════════════════════════════════ */}
      <section className="mb-[72px]">
        <h2
          className="text-[11px] uppercase tracking-[0.12em] font-medium mb-8"
          style={{ color: "var(--ink)", opacity: 0.4 }}
        >
          파이프라인
        </h2>

        <div
          className="
            grid grid-cols-1 sm:grid-cols-2
            gap-px bg-[var(--line)]
            border border-[var(--line)] rounded-[10px] overflow-hidden
          "
        >
          {pipeline.map((item) => (
            <div
              key={item.step}
              className="p-6 sm:p-8 bg-[var(--bg-elev)]"
            >
              <span
                className="block text-[11px] font-medium mb-5 tabular-nums"
                style={{ color: "var(--ink)", opacity: 0.3 }}
              >
                {item.step}
              </span>
              <h3
                className="text-[15px] font-medium leading-snug mb-2"
                style={{ color: "var(--ink)" }}
              >
                {item.title}
              </h3>
              <p
                className="text-[13px] leading-[1.75] mb-4"
                style={{ color: "var(--ink)", opacity: 0.55 }}
              >
                {item.desc}
              </p>
              <span
                className="inline-block text-[11px] px-2.5 py-1 rounded-full border border-[var(--line)]"
                style={{ color: "var(--ink)", opacity: 0.45 }}
              >
                {item.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          [수정 6] CTA 섹션 패딩
          before: style={{ padding:'56px 48px' }}
          after : p-8 sm:p-[56px_48px]
      ══════════════════════════════════════════════════════ */}
      <section
        className="
          p-8 sm:p-[56px_48px]
          border border-[var(--line)] rounded-xl
          bg-[var(--bg-elev)]
        "
      >
        <div className="max-w-[480px]">
          <h2
            className="text-[24px] sm:text-[32px] font-medium leading-[1.1] tracking-[-0.025em] mb-4"
            style={{ color: "var(--ink)" }}
          >
            신호를 먼저 받아보세요.
          </h2>
          <p
            className="text-[14px] sm:text-[15px] leading-[1.75] mb-8"
            style={{ color: "var(--ink)", opacity: 0.55 }}
          >
            매주 탐지된 게임 신호를 이메일로 받아볼 수 있습니다.
            스팸 없이, 언제든 해지 가능합니다.
          </p>
          <a
            href="/subscribe"
            className="
              inline-flex items-center gap-2
              px-6 py-3 rounded-xl text-sm font-medium
              bg-slate-900 dark:bg-slate-100
              text-white dark:text-slate-900
              hover:bg-slate-700 dark:hover:bg-white
              transition-colors duration-150
            "
          >
            무료로 신호 받기
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </section>

    </main>
  );
}
