import { NextResponse } from 'next/server';
import pool from '@/app/lib/db';

// 시크릿 키로 API 보호
const API_SECRET = process.env.NEWS_API_SECRET;

export async function POST(request: Request) {
  // 인증 확인
  const authHeader = request.headers.get('authorization');
  if (!API_SECRET || authHeader !== `Bearer ${API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { date, clips, summary } = await request.json();

    // 뉴스 클립 저장
    let saved = 0;
    for (const clip of clips) {
      await pool.query(`
        INSERT INTO news_clips
          (clip_date, category, importance, title, summary,
           analyst_comment, source_url, related_ticker, related_company)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (clip_date, title) DO UPDATE SET
          summary         = EXCLUDED.summary,
          analyst_comment = EXCLUDED.analyst_comment,
          importance      = EXCLUDED.importance
      `, [
        date, clip.category, clip.importance,
        clip.title, clip.summary, clip.analystComment,
        clip.sourceUrl || 'https://www.inven.co.kr/',
        clip.relatedTicker || null,
        clip.relatedCompany || null
      ]);
      saved++;
    }

    // 핵심 요약 저장
    if (summary) {
      await pool.query(`
        INSERT INTO news_summaries (clip_date, summary)
        VALUES ($1, $2)
        ON CONFLICT (clip_date) DO UPDATE SET summary = EXCLUDED.summary
      `, [date, summary]);
    }

    return NextResponse.json({ success: true, saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
