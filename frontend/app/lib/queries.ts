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
      s.signal_id, s.signal_date, s.signal_type, s.priority,
      s.payload, s.notified_at,
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
      s.signal_id, s.signal_date, s.signal_type, s.priority,
      s.payload, s.notified_at,
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
  return rows;
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
  const orderClause = `
    ORDER BY
      CASE importance WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      category,
      created_at
  `;

  const { rows: clips } = date
    ? await pool.query(`SELECT * FROM news_clips WHERE clip_date = $1 ${orderClause}`, [date])
    : await pool.query(`SELECT * FROM news_clips WHERE clip_date = CURRENT_DATE ${orderClause}`);

  const { rows: summaries } = date
    ? await pool.query(`SELECT * FROM news_summaries WHERE clip_date = $1 LIMIT 1`, [date])
    : await pool.query(`SELECT * FROM news_summaries WHERE clip_date = CURRENT_DATE LIMIT 1`);

  return { clips, summary: summaries[0] || null };
}

export async function getNewsDateList(): Promise<string[]> {
  const { rows } = await pool.query(`
    SELECT DISTINCT clip_date
    FROM news_clips
    ORDER BY clip_date DESC
    LIMIT 30
  `);
  return rows.map(r => r.clip_date);
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
