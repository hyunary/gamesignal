const { saveNewsClip, saveSummary, classifyImportance, extractTicker } = require('../src/collectors/invenNews');
const pool = require('../src/db/pool');

async function run() {
  const today = new Date();
  const kstTime = new Date(today.getTime() + 9 * 60 * 60 * 1000);
  const date = kstTime.toISOString().split('T')[0];

  console.log(`📰 인벤 뉴스 저장 시작 (${date})`);

  const clips = [
    {
      category: 'business',
      title: "블리자드 '오버워치' PC버전 한국 서비스 연내 넥슨으로 이관",
      summary: "넥슨이 한국 시장 맞춤 라이브 서비스와 PC방 생태계 확장 담당, 블리자드는 개발 총괄. 계정 연동 및 유료 재화 정책은 미정.",
      analystComment: "넥슨의 대형 IP 운영권 확보는 PC방 트래픽 기반 광고·부가수익 확대로 이어질 수 있어 단기 긍정적. 블리자드-넥슨 수익 분배 구조가 마진율의 핵심 변수.",
      sourceUrl: "https://www.inven.co.kr/"
    },
    {
      category: 'business',
      title: "붉은사막(Crimson Desert) 역주행 — 스팀 CCU 27만명 돌파",
      summary: "펄어비스 신작이 초반 혹평을 극복하고 Steam 최고 동시접속자 27만명을 기록하며 반등. GameSignal 현재 Most Played 3위 (CCU 244,671명).",
      analystComment: "신규 IP 기준 이례적 성과. 펄어비스(263750.KS) 단기 주가 모멘텀 유효, 글로벌 론칭 확대 시 추가 상승 여력 존재.",
      sourceUrl: "https://www.inven.co.kr/"
    },
    {
      category: 'business',
      title: "PUBG: 블라인드 스팟 오늘 서비스 종료 — 크래프톤 산하 아크팀",
      summary: "3월 30일 오후 6시부로 서비스 종료. 크래프톤이 서비스 담당.",
      analystComment: "운영비 절감 측면 단기 중립적. 크래프톤(259960.KS) PUBG 본 IP 집중 전략으로 해석 가능.",
      sourceUrl: "https://www.inven.co.kr/"
    },
    {
      category: 'business',
      title: "GTA6 출시(11월 19일) 앞두고 락스타 에든버러 대규모 QA 채용",
      summary: "핵심 스튜디오에서 기술 QA 인력 대규모 채용. 출시 임박을 알리는 강력한 신호로 해석.",
      analystComment: "Take-Two(TTWO) 긍정적. GTA6 선판매 모멘텀이 4분기 실적 서프라이즈 가능성으로 연결.",
      sourceUrl: "https://www.inven.co.kr/"
    },
    {
      category: 'newgame',
      title: "'신데리아' 오늘 출시 + '더 디비전: 리서전스' 내일 모바일 출시",
      summary: "신데리아 3월 30일 정식 서비스 시작. 더 디비전 모바일 버전 3월 31일 출시.",
      analystComment: "모바일 AAA IP의 한국 시장 공략 지속. 유비소프트(UBI.PA) 모바일 전략 성과 확인 필요.",
      sourceUrl: "https://www.inven.co.kr/"
    },
    {
      category: 'business',
      title: "구글 안드로이드 인앱결제 구조 3월부터 개편 — 국내 게임업계 수익모델 변화",
      summary: "구글이 2026년 3월부터 안드로이드 인앱결제 구조를 대대적으로 개편. 국내 게임업계 수익 모델에 변화 감지.",
      analystComment: "모바일 게임사 전반 마진율 압박 요인. 원스토어 등 대안 결제 플랫폼 수혜 가능성 모니터링 필요.",
      sourceUrl: "https://www.inven.co.kr/"
    }
  ];

  for (const clip of clips) {
    const importance = classifyImportance(clip.title, clip.summary);
    const { ticker, company } = extractTicker(clip.title, clip.summary);
    await saveNewsClip({
      date,
      category: clip.category,
      importance,
      title: clip.title,
      summary: clip.summary,
      analystComment: clip.analystComment,
      sourceUrl: clip.sourceUrl,
      relatedTicker: ticker,
      relatedCompany: company
    });
    console.log(`  ✅ 저장: ${clip.title.slice(0, 30)}...`);
  }

  await saveSummary(date,
    "1. 붉은사막 역주행 + 오버워치 넥슨 이관 — 펄어비스·넥슨 IP 경쟁력 재조명. 펄어비스 주가 모멘텀 주목.\n" +
    "2. GTA6 출시 카운트다운 — Take-Two 관련 포지션 재검토 시점.\n" +
    "3. 구글 인앱결제 개편 — 모바일 게임사 수익 구조 변화 중장기 리스크 모니터링 필요."
  );

  console.log(`\n🎉 총 ${clips.length}개 뉴스 저장 완료!`);
  await pool.end();
}

run().catch(console.error);
