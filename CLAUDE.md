# GameSignal MVP
## 프로젝트 개요
Steam 게임 트래픽 데이터를 매일 자동 수집해서 신호(Signal)를 감지하고 알려주는 서비스.
## 기술 스택
- Runtime: Node.js 20
- Database: PostgreSQL 15
- Cache: Redis
- Scraping: Playwright (Python)
- Framework: Express.js
- Scheduler: GitHub Actions
## 중요 원칙
- 항상 한국어로 대화할 것
- 코드 작성 후 반드시 실행해서 동작 확인할 것
- 에러 발생 시 스스로 원인 파악 후 수정할 것
- 한 번에 하나의 티켓만 완료 후 나에게 보고할 것
## 현재 상태
Day 1 시작 - 환경 구성 단계

## 변경 이력
- GS-020: Steam 공식 위시리스트 페이지 삭제됨 (2026-03)
  → SteamSpy top100in2weeks API로 대체
  → wishlist_rank 컬럼 의미: SteamSpy 2주 기준 인기 순위
