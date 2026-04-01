const axios = require('axios');
const pool = require('../db/pool');
const { sleep } = require('../utils/sleep');

// YouTube Data API v3 키 (환경변수에서 로드)
function getYoutubeApiKey() {
  const keys = JSON.parse(process.env.YOUTUBE_API_KEYS || '[]');
  return keys[0] || null;
}

// 게임 관련 YouTube 영상 검색
async function searchGameVideo(gameTitle) {
  const apiKey = getYoutubeApiKey();
  if (!apiKey) throw new Error('YouTube API 키 없음');

  const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: {
      key: apiKey,
      q: `${gameTitle} game review 2025 2026`,
      type: 'video',
      part: 'snippet',
      maxResults: 3,
      order: 'relevance',
      videoDuration: 'medium',
      relevanceLanguage: 'en'
    },
    timeout: 10000
  });

  const videos = data.items || [];
  if (videos.length === 0) return null;

  const video = videos[0];
  return {
    videoId: video.id.videoId,
    title: video.snippet.title,
    url: `https://www.youtube.com/watch?v=${video.id.videoId}`
  };
}

// 댓글 수집 (최대 100개)
async function fetchComments(videoId) {
  const apiKey = getYoutubeApiKey();

  const { data } = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
    params: {
      key: apiKey,
      videoId,
      part: 'snippet',
      maxResults: 100,
      order: 'relevance',
      textFormat: 'plainText'
    },
    timeout: 10000
  });

  return (data.items || []).map(item =>
    item.snippet.topLevelComment.snippet.textDisplay
  );
}

// 키워드 기반 감성 분석
function analyzeComment(text) {
  const t = text.toLowerCase();

  const positiveWords = [
    'amazing', 'awesome', 'great', 'love', 'excellent', 'fantastic',
    'perfect', 'best', 'good', 'fun', 'enjoy', 'recommend', 'brilliant',
    'beautiful', 'incredible', 'outstanding', '좋아', '최고', '재미있', '추천',
    '훌륭', '완벽', '즐거', '멋진'
  ];

  const negativeWords = [
    'bad', 'terrible', 'awful', 'hate', 'boring', 'worst', 'waste',
    'disappointing', 'poor', 'broken', 'buggy', 'trash', 'garbage',
    'refund', 'avoid', '별로', '최악', '실망', '쓰레기', '환불', '재미없',
    '노잼', '구림'
  ];

  const posScore = positiveWords.filter(w => t.includes(w)).length;
  const negScore = negativeWords.filter(w => t.includes(w)).length;

  if (posScore > negScore) return 'positive';
  if (negScore > posScore) return 'negative';
  return 'neutral';
}

// 전체 감성 분석 실행
async function analyzeGameSentiment(appId, gameTitle) {
  console.log(`  🎬 YouTube 분석: ${gameTitle}`);

  try {
    // 영상 검색
    const video = await searchGameVideo(gameTitle);
    if (!video) {
      console.log(`  ⚠️ 영상 없음: ${gameTitle}`);
      return null;
    }
    console.log(`  📹 영상 발견: ${video.title}`);

    await sleep(1000);

    // 댓글 수집
    const comments = await fetchComments(video.videoId);
    if (comments.length === 0) {
      console.log(`  ⚠️ 댓글 없음: ${gameTitle}`);
      return null;
    }
    console.log(`  💬 댓글 ${comments.length}개 수집`);

    // 감성 분류
    const results = comments.map(analyzeComment);
    const positive = results.filter(r => r === 'positive').length;
    const negative = results.filter(r => r === 'negative').length;
    const neutral  = results.filter(r => r === 'neutral').length;
    const total    = results.length;

    const positivePct = ((positive / total) * 100).toFixed(1);
    const negativePct = ((negative / total) * 100).toFixed(1);
    const neutralPct  = ((neutral  / total) * 100).toFixed(1);

    console.log(`  ✅ 긍정 ${positivePct}% / 중립 ${neutralPct}% / 부정 ${negativePct}%`);

    // DB 저장
    // KST 기준 오늘 날짜 (UTC+9)
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today = kst.toISOString().split('T')[0];
    await pool.query(`
      INSERT INTO youtube_sentiment
        (app_id, analysis_date, video_id, video_title, video_url,
         comments_total, positive_count, neutral_count, negative_count,
         positive_pct, neutral_pct, negative_pct)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (app_id, analysis_date, video_id) DO UPDATE SET
        comments_total = EXCLUDED.comments_total,
        positive_count = EXCLUDED.positive_count,
        neutral_count  = EXCLUDED.neutral_count,
        negative_count = EXCLUDED.negative_count,
        positive_pct   = EXCLUDED.positive_pct,
        neutral_pct    = EXCLUDED.neutral_pct,
        negative_pct   = EXCLUDED.negative_pct
    `, [
      appId, today, video.videoId, video.title, video.url,
      total, positive, neutral, negative,
      positivePct, neutralPct, negativePct
    ]);

    return {
      videoTitle: video.title,
      videoUrl: video.url,
      total, positive, neutral, negative,
      positivePct, neutralPct, negativePct
    };

  } catch (err) {
    console.error(`  ❌ YouTube 분석 실패 (${gameTitle}):`, err.message);
    return null;
  }
}

module.exports = { analyzeGameSentiment };
