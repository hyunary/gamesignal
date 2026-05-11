/**
 * HeroSection.tsx
 * ② Hero 섹션 — 확정 카피 + CTA smooth scroll
 *
 * 헤드라인: "게임이 뜨기 전에 신호가 옵니다."
 * 서브카피: NoiseCatcher 소개
 * CTA: "서비스 살펴보기" → #service-section smooth scroll
 */

import React from "react";

export function HeroSection() {
  const handleCTA = () => {
    const target = document.getElementById("service-section");
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="relative flex flex-col items-center justify-center text-center px-4 pt-24 pb-20 sm:pt-32 sm:pb-28">
      {/* 배경 노이즈 텍스처 (선택적) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
        }}
      />

      {/* 브랜드 워드마크 */}
      <div className="mb-8 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tracking-widest uppercase">
          NoiseCatcher
        </span>
      </div>

      {/* 헤드라인 */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-slate-900 dark:text-slate-50 leading-tight tracking-tight max-w-2xl">
        게임이 뜨기 전에
        <br />
        <span className="text-slate-400 dark:text-slate-500">신호가 옵니다.</span>
      </h1>

      {/* 서브카피 */}
      <p className="mt-5 text-base sm:text-lg text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
        NoiseCatcher는 스팀·커뮤니티·검색 노이즈를 분석해
        <br className="hidden sm:block" />
        트래픽 급등 전 신호를 매주 전달합니다.
      </p>

      {/* CTA — 기존 primary 버튼 Tailwind 클래스 재사용 */}
      <button
        onClick={handleCTA}
        className="
          mt-8
          inline-flex items-center gap-2
          px-6 py-3 rounded-xl
          bg-slate-900 dark:bg-slate-100
          text-white dark:text-slate-900
          text-sm font-medium
          hover:bg-slate-700 dark:hover:bg-white
          transition-colors duration-150
        "
      >
        서비스 살펴보기
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </section>
  );
}

export default HeroSection;
