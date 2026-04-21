import pool from '../../lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM news_clips)                                      AS total_clips,
        (SELECT COUNT(DISTINCT clip_date)::int FROM news_clips)                    AS total_days,
        (SELECT COUNT(*)::int FROM forecasts)                                       AS total_forecasts,
        (SELECT COUNT(*)::int FROM forecast_threads)                                AS total_threads,
        (SELECT COUNT(*)::int FROM forecast_suggestions WHERE status = 'pending')  AS pending_suggestions,
        (SELECT MAX(clip_date)::text FROM news_clips)                              AS last_clip_date,
        (SELECT COUNT(*)::int FROM forecast_schedule
          WHERE due_date >= CURRENT_DATE)                                           AS upcoming_schedules
    `);
    return NextResponse.json(rows[0]);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
