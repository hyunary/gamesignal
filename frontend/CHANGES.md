# NoiseCatcher Sprint 0 — FE 변경 요약

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `index.html` | `<title>` · `<meta name="description">` GameSignal → NoiseCatcher 교체, OG 태그 7개 신규 추가 |
| `src/components/sections/HeroSection.tsx` | 헤드라인·서브카피 확정 카피 적용, CTA `#service-section` smooth scroll 연결 |
| `src/components/sections/MadeBySection.tsx` | 신규 생성 — 만든 사람 섹션 (토마스, 확정 본문, 외부 링크 없음) |
| `public/manifest.json` | `name` · `short_name` → "NoiseCatcher" 교체 |
| `src/api/apiClient.ts` | 주석 내 "GameSignal" → "NoiseCatcher" 교체 (VITE_API_KEY · gs_live_ prefix 유지) |

---

## ① 브랜드 교체 체크리스트

- [x] `index.html` `<title>` → NoiseCatcher
- [x] `index.html` `<meta name="description">` → NoiseCatcher
- [x] `public/manifest.json` name / short_name → NoiseCatcher
- [x] `apiClient.ts` 주석 교체 (환경변수명·API prefix 변경 없음)
- [ ] `src/components/layout/Header` — 로고 텍스트 교체 필요 (현장 확인 후 처리)
- [ ] `src/components/layout/Footer` — 푸터 브랜드명 교체 필요 (현장 확인 후 처리)
- [ ] `src/pages/` — 각 페이지 h1 텍스트 검색 후 교체 필요

> **SVG/PNG 로고 파일 존재 여부 미확인.** 파일이 있다면 텍스트 로고("NoiseCatcher")로 임시 대체 후 별도 보고.

---

## ② Hero 섹션

- [x] 헤드라인: "게임이 뜨기 전에 신호가 옵니다."
- [x] 서브카피: NoiseCatcher 설명 2줄
- [x] CTA 버튼: "서비스 살펴보기" → `#service-section` smooth scroll
- [x] 기존 primary 버튼 Tailwind 클래스 재사용 (신규 스타일 추가 없음)

---

## ③ MadeBySection

- [x] `src/components/sections/MadeBySection.tsx` 신규 생성
- [x] 확정 본문 5문장 그대로 적용
- [x] LinkedIn · 이메일 · 외부 링크 없음
- [x] 기존 카드 컴포넌트 스타일 재사용

**페이지 배치 방법** — `App.tsx` (또는 랜딩 페이지 컴포넌트)에 아래와 같이 추가:

```tsx
// ...서비스 소개 섹션 하단
<MadeBySection />
<Footer />
```

---

## ④ OG 태그 + 도메인

- [x] `<title>` 적용
- [x] `og:title` · `og:description` · `og:image` · `og:url` · `og:type` 적용
- [x] `twitter:card` 적용
- [ ] `public/og-image.png` — **별도 제작 필요** (1200×630px, Figma/Canva)
- [ ] Vercel 도메인 연결 — Vercel Dashboard → Settings → Domains → `noisecatcher.ai`
- [ ] Porkbun DNS: A 레코드 `76.76.21.21` / CNAME `cname.vercel-dns.com`

---

## QA 투입 전 확인 사항

| 항목 | 상태 |
|------|------|
| 콘솔 에러 없음 | 배포 후 확인 |
| 404 페이지 존재 | 배포 후 확인 |
| HTTPS 정상 | Vercel 자동 발급 (도메인 연결 후) |
| 카카오톡 OG 미리보기 | og-image.png 제작 후 확인 |
| 모바일 Hero 스크린샷 | 배포 후 캡처 |
| 모바일 Made by 스크린샷 | 배포 후 캡처 |

---

## 미완료 항목 (현장 파일 확인 필요)

1. `src/components/layout/Header.tsx` — 로고·네비 텍스트 GameSignal 잔존 여부 확인
2. `src/components/layout/Footer.tsx` — 브랜드명 잔존 여부 확인
3. `src/pages/` 전체 — `grep -r "GameSignal" src/pages/` 실행 후 교체
4. SVG/PNG 로고 파일 존재 시 텍스트 로고 임시 대체
5. `public/og-image.png` 제작 (1200×630px)
