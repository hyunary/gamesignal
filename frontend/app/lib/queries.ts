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
      ps.company_name, ps.stock_ticker, ps.exchange, ps.is_listed
    FROM signals s
    JOIN games g USING(app_id)
    LEFT JOIN game_snapshots snap
      ON snap.app_id = s.app_id AND snap.snapshot_date = s.signal_date
    LEFT JOIN publisher_stocks ps
      ON ps.developer_name = g.developer
      OR ps.developer_name = g.publisher
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
