const axios = require('axios');
const pool = require('../db/pool');

// 중요도 키워드 기반 분류
function classifyImportance(title, summary) {
  const text = (title + ' ' + summary).toLowerCase();
  const highKeywords = ['인수', 'M&A', '투자', '상장', 'IPO', '서비스 종료', '이관', '합병', '계약', '플랫폼 정책', '규제'];
  const lowKeywords = ['업데이트', '패치', '이벤트', '스킨', '할인', '커뮤니티'];
  if (highKeywords.some(k => text.includes(k))) return 'high';
  if (lowKeywords.some(k => text.includes(k))) return 'low';
  return 'medium';
}

// 관련 상장사 자동 태깅
function extractTicker(title, summary) {
  const text = title + ' ' + summary;
  const tickerMap = [
    { keywords: ['넥슨', 'nexon'], ticker: '3659.T', company: '넥슨' },
    { keywords: ['크래프톤', 'krafton', 'pubg'], ticker: '259960.KS', company: '크래프톤' },
    { keywords: ['펄어비스', 'pearl abyss', '붉은사막', '검은사막'], ticker: '263750.KS', company: '펄어비스' },
    { keywords: ['엔씨소프트', 'ncsoft', 'nc소프트'], ticker: '036570.KS', company: '엔씨소프트' },
    { keywords: ['넷마블', 'netmarble'], ticker: '251270.KS', company: '넷마블' },
    { keywords: ['카카오게임즈', 'kakao games'], ticker: '293490.KS', company: '카카오게임즈' },
    { keywords: ['take-two', 'rockstar', 'gta', '2k games'], ticker: 'TTWO', company: 'Take-Two' },
    { keywords: ['ea ', 'electronic arts'], ticker: 'EA', company: 'Electronic Arts' },
    { keywords: ['ubisoft', '유비소프트'], ticker: 'UBI.PA', company: 'Ubisoft' },
    { keywords: ['microsoft', '마이크로소프트', 'xbox', 'blizzard', '블리자드', 'activision'], ticker: 'MSFT', company: 'Microsoft' },
    { keywords: ['tencent', '텐센트'], ticker: '700.HK', company: 'Tencent' },
    { keywords: ['capcom', '캡콤'], ticker: '9697.T', company: 'Capcom' },
    { keywords: ['square enix', '스퀘어에닉스'], ticker: '9684.T', company: 'Square Enix' },
  ];
  for (const entry of tickerMap) {
    if (entry.keywords.some(k => text.toLowerCase().includes(k))) {
      return { ticker: entry.ticker, company: entry.company };
    }
  }
  return { ticker: null, company: null };
}

// 뉴스 DB 저장
async function saveNewsClip(clip) {
  try {
    await pool.query(`
      INSERT INTO news_clips
        (clip_date, category, importance, title, summary, analyst_comment,
         source_url, related_ticker, related_company)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (clip_date, title) DO UPDATE SET
        summary          = EXCLUDED.summary,
        analyst_comment  = EXCLUDED.analyst_comment,
        importance       = EXCLUDED.importance
    `, [
      clip.date, clip.category, clip.importance,
      clip.title, clip.summary, clip.analystComment,
      clip.sourceUrl, clip.relatedTicker, clip.relatedCompany
    ]);
    return true;
  } catch (err) {
    console.error('저장 실패:', err.message);
    return false;
  }
}

// 핵심 요약 저장
async function saveSummary(date, summary) {
  await pool.query(`
    INSERT INTO news_summaries (clip_date, summary)
    VALUES ($1, $2)
    ON CONFLICT (clip_date) DO UPDATE SET summary = EXCLUDED.summary
  `, [date, summary]);
}

module.exports = { saveNewsClip, saveSummary, classifyImportance, extractTicker };
