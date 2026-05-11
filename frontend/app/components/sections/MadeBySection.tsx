/**
 * MadeBySection.tsx
 * ③ Made by 섹션 — 신규 생성
 *
 * 위치: 서비스 소개 섹션(#service-section) 하단, Footer 바로 위
 * 스타일: 기존 카드 컴포넌트 재사용, 텍스트 중심, 과한 장식 없음
 * 제외: LinkedIn 링크, 이메일 링크, 외부 연결 일체
 */

import React from "react";

export function MadeBySection() {
  return (
    <section className="px-4 py-16 sm:py-20">
      <div className="max-w-2xl mx-auto">
        {/* 섹션 레이블 */}
        <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">
          만든 사람
        </p>

        {/* 카드 — 기존 카드 컴포넌트 스타일 재사용 */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl p-6 sm:p-8">
          {/* 이름 */}
          <div className="flex items-center gap-3 mb-5">
            {/* 이니셜 아바타 */}
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">토</span>
            </div>
            <div>
              <p className="text-[15px] font-medium text-slate-900 dark:text-slate-100">
                토마스
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                NoiseCatcher 메이커
              </p>
            </div>
          </div>

          {/* 본문 — 확정 텍스트 */}
          <p className="text-[14px] text-slate-600 dark:text-slate-400 leading-[1.85] whitespace-pre-line">
            {`게임 하나가 폭발적으로 성장하는 순간,
대부분의 사람들은 그 이후에야 알게 됩니다.
저는 그 순간을 미리 포착할 수 있다면 어떨까를
오래 고민했고, NoiseCatcher를 직접 만들었습니다.
사이드 프로젝트로 시작했지만, 실제로 작동하는 걸
보고 나서 진지하게 키우고 싶어졌습니다.`}
          </p>
        </div>
      </div>
    </section>
  );
}

export default MadeBySection;
