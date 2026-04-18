import pool from './db';

export interface Signal {
  signal_id: string;
  signal_date: string;
  signal_type: string;
  priority: string;
  payload: any;
  app_id: number;
  title: string;
  genres: string[];
  header_image_url: string;
  most_played_rank: number;
  concurrent_users: number;
  wishlist_rank: number;
  notified_at: string;
  company_name: string | null;
  stock_ticker: string | null;
  exchange: string | null;
  is_listed: boolean | null;
  positive_pct: number | null;
  neutral_pct: number | null;
  negative_pct: number | null;
  video_url: string | null;
  video_title: string | null;
  comments_total: number | null;
  is_first_ever_entry_mp: boolean | null;
}

export interface PipelineRun {
  run_date: string;
  source: string;
  status: string;
  duration_sec: number;
  rows_collected: number;
  rows_failed: number;
  error_message: string;
}

export async function getTodaySignals(): Promise<Signal[]> {
  const { rows } = await pool.query(`
    SELECT
      s.signal_id, s.signal_date::text AS signal_date, s.signal_type, s.priority,
      s.payload, s.notified_at::text AS notified_at,
      g.app_id, g.title, g.genres, g.header_image_url,
      snap.most_played_rank, snap.concurrent_users, snap.wishlist_rank,
      ps.company_name, ps.stock_ticker, ps.exchange, ps.is_listed,
      yt.positive_pct, yt.neutral_pct, yt.negative_pct,
      yt.video_url, yt.video_title, yt.comments_total,
      snap.is_first_ever_entry_mp
    FROM signals s
    JOIN games g USING(app_id)
    LEFT JOIN game_snapshots snap
      ON snap.app_id = s.app_id AND snap.snapshot_date = s.signal_date
    LEFT JOIN publisher_stocks ps
      ON ps.developer_name = g.developer
      OR ps.developer_name = g.publisher
    LEFT JOIN youtube_sentiment yt
      ON yt.app_id = s.app_id AND yt.analysis_date = s.signal_date
    WHERE s.signal_date = CURRENT_DATE
      AND s.signal_type != 'composite'
    ORDER BY
      CASE s.priority WHEN 'P0' THEN 0 ELSE 1 END,
      s.created_at DESC
    LIMIT 20
  `);
  return rows;
}

export async function getRecentSignals(): Promise<Signal[]> {
  const { rows } = await pool.query(`
    SELECT
      s.signal_id, s.signal_date::text AS signal_date, s.signal_type, s.priority,
      s.payload, s.notified_at::text AS notified_at,
      g.app_id, g.title, g.genres, g.header_image_url,
      snap.most_played_rank, snap.concurrent_users, snap.wishlist_rank,
      ps.company_name, ps.stock_ticker, ps.exchange, ps.is_listed
    FROM signals s
    JOIN games g USING(app_id)
    LEFT JOIN game_snapshots snap
      ON snap.app_id = s.app_id AND snap.snapshot_date = s.signal_date
    LEFT JOIN publisher_stocks ps
      ON ps.developer_name = g.developer
      OR ps.developer_name = g.publisher
    WHERE s.signal_date >= CURRENT_DATE - 7
      AND s.signal_type != 'composite'
    ORDER BY s.signal_date DESC,
      CASE s.priority WHEN 'P0' THEN 0 ELSE 1 END,
      s.created_at DESC
    LIMIT 50
  `);
  return rows;
}

export async function getPipelineStatus(): Promise<PipelineRun[]> {
  const { rows } = await pool.query(`
    SELECT * FROM v_pipeline_sla
    ORDER BY run_date DESC, started_at DESC
    LIMIT 20
  `);
  return rows.map((r: any) => ({
    ...r,
    run_date: r.run_date instanceof Date ? r.run_date.toISOString().split('T')[0] : String(r.run_date ?? ''),
  }));
}

export interface SignalHistory {
  day: string;
  p0: number;
  p1: number;
  p2: number;
}

export async function getSignalHistory(): Promise<SignalHistory[]> {
  const { rows } = await pool.query(`
    SELECT
      signal_date::text AS day,
      SUM(CASE WHEN priority = 'P0' THEN 1 ELSE 0 END)::int AS p0,
      SUM(CASE WHEN priority = 'P1' THEN 1 ELSE 0 END)::int AS p1,
      SUM(CASE WHEN priority = 'P2' THEN 1 ELSE 0 END)::int AS p2
    FROM signals
    WHERE signal_date >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY signal_date
    ORDER BY signal_date ASC
  `);

  const result: SignalHistory[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000 - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = dateStr.slice(5); // MM-DD
    const found = rows.find((r: any) => r.day === dateStr);
    result.push({ day: dayLabel, p0: found?.p0 || 0, p1: found?.p1 || 0, p2: found?.p2 || 0 });
  }
  return result;
}

export interface NewsClip {
  id: number;
  clip_date: string;
  category: string;
  importance: string;
  title: string;
  summary: string;
  analyst_comment: string | null;
  source_url: string | null;
  related_ticker: string | null;
  related_company: string | null;
}

export interface NewsSummary {
  clip_date: string;
  summary: string;
}

export async function getNewsByDate(date?: string): Promise<{ clips: NewsClip[]; summary: NewsSummary | null }> {
  // KST 기준 오늘 날짜 계산 (UTC+9)
  const kstDate = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  // 오늘 날짜 지정 or 명시적 date 파라미터
  const targetDate = date || kstDate;

  // 해당 날짜에 데이터가 없으면 가장 최근 날짜로 fallback
  const { rows: dateCheck } = await pool.query(`
    SELECT clip_date::text FROM news_clips
    WHERE clip_date = $1
    LIMIT 1
  `, [targetDate]);

  let dateParam: string;
  if (dateCheck.length > 0) {
    dateParam = targetDate;
  } else {
    // 가장 최근 날짜 조회
    const { rows: latestDate } = await pool.query(`
      SELECT clip_date::text FROM news_clips
      ORDER BY clip_date DESC
      LIMIT 1
    `);
    dateParam = latestDate.length > 0
      ? latestDate[0].clip_date
      : targetDate;
  }

  const orderClause = `
    ORDER BY
      CASE importance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      category,
      created_at
  `;

  const { rows: clips } = await pool.query(
    `SELECT * FROM news_clips WHERE clip_date = $1 ${orderClause}`,
    [dateParam]
  );

  const { rows: summaries } = await pool.query(
    `SELECT * FROM news_summaries WHERE clip_date = $1 LIMIT 1`,
    [dateParam]
  );

  const toDateStr = (v: unknown) =>
    v instanceof Date ? v.toISOString().split('T')[0] : (v as string);

  const normalizedClips = clips.map(r => ({
    ...r,
    clip_date: toDateStr(r.clip_date),
  }));

  const rawSummary = summaries[0] || null;
  const normalizedSummary = rawSummary
    ? { ...rawSummary, clip_date: toDateStr(rawSummary.clip_date) }
    : null;

  return { clips: normalizedClips, summary: normalizedSummary };
}

export async function getNewsDateList(): Promise<string[]> {
  const { rows } = await pool.query(`
    SELECT DISTINCT clip_date
    FROM news_clips
    ORDER BY clip_date DESC
    LIMIT 30
  `);
  return rows.map(r =>
    r.clip_date instanceof Date ? r.clip_date.toISOString().split('T')[0] : r.clip_date
  );
}

export interface Forecast {
  id: number;
  game_slug: string;
  game_title: string;
  app_id: number | null;
  developer: string | null;
  publisher: string | null;
  platform: string | null;
  genre: string | null;
  release_date: string | null;
  bear_min: number | null;
  base_min: number | null;
  base_max: number | null;
  bull_max: number | null;
  game_pass: boolean;
  status: string;
  cover_image_url: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface ForecastThread {
  id: number;
  forecast_id: number;
  milestone_type: string;
  milestone_label: string;
  content: string;
  updated_bear_min: number | null;
  updated_base_min: number | null;
  updated_base_max: number | null;
  updated_bull_max: number | null;
  thread_date: string;
  created_at: string;
}

export async function getAllForecasts(): Promise<Forecast[]> {
  const { rows } = await pool.query(`
    SELECT * FROM forecasts
    WHERE status != 'draft'
    ORDER BY updated_at DESC
  `);
  return rows.map(r => ({
    ...r,
    release_date: r.release_date
      ? new Date(r.release_date.getTime ? r.release_date.getTime() + 9*60*60*1000 : r.release_date)
          .toISOString().split('T')[0]
      : null,
    created_at: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
    updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at,
  }));
}

export async function getForecastBySlug(slug: string): Promise<{ forecast: Forecast; threads: ForecastThread[] } | null> {
  const { rows: forecasts } = await pool.query(`
    SELECT * FROM forecasts WHERE game_slug = $1
  `, [slug]);

  if (forecasts.length === 0) return null;

  const forecast = {
    ...forecasts[0],
    release_date: forecasts[0].release_date
      ? new Date(forecasts[0].release_date.getTime ? forecasts[0].release_date.getTime() + 9*60*60*1000 : forecasts[0].release_date)
          .toISOString().split('T')[0]
      : null,
    created_at: forecasts[0].created_at instanceof Date ? forecasts[0].created_at.toISOString() : forecasts[0].created_at,
    updated_at: forecasts[0].updated_at instanceof Date ? forecasts[0].updated_at.toISOString() : forecasts[0].updated_at,
  };

  const { rows: threads } = await pool.query(`
    SELECT * FROM forecast_threads
    WHERE forecast_id = $1
    ORDER BY thread_date DESC, created_at DESC
  `, [forecast.id]);

  return {
    forecast,
    threads: threads.map(t => ({
      ...t,
      thread_date: t.thread_date instanceof Date ? t.thread_date.toISOString().split('T')[0] : t.thread_date,
      created_at: t.created_at instanceof Date ? t.created_at.toISOString() : t.created_at,
    }))
  };
}

export interface ForecastSuggestion {
  id: number;
  suggestion_type: 'new_forecast' | 'update_forecast';
  game_title: string;
  reason: string;
  forecast_id: number | null;
  status: string;
  created_at: string;
}

export async function getForecastSuggestions(): Promise<ForecastSuggestion[]> {
  const { rows } = await pool.query(`
    SELECT id, suggestion_type, game_title, reason, forecast_id, status, created_at::text
    FROM forecast_suggestions
    WHERE status = 'pending'
    ORDER BY created_at DESC
    LIMIT 5
  `);
  return rows;
}

export async function getTopGames() {
  const { rows } = await pool.query(`
    SELECT
      g.app_id, g.title, g.genres, g.header_image_url,
      g.developer,
      s.most_played_rank, s.concurrent_users,
      s.wishlist_rank
    FROM game_snapshots s
    JOIN games g USING(app_id)
    WHERE s.snapshot_date = CURRENT_DATE
      AND s.most_played_rank IS NOT NULL
    ORDER BY s.most_played_rank
    LIMIT 20
  `);
  return rows;
}
