-- ============================================================
-- GameSignal MVP — DB Schema Migration
-- Version : v1.0
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- 1. games (게임 마스터 테이블)
CREATE TABLE IF NOT EXISTS games (
    app_id              INTEGER         PRIMARY KEY,
    title               VARCHAR(255)    NOT NULL,
    developer           VARCHAR(255),
    publisher           VARCHAR(255),
    release_date        DATE,
    genres              TEXT[],
    tags                TEXT[],
    is_early_access     BOOLEAN         NOT NULL DEFAULT FALSE,
    is_free_to_play     BOOLEAN         NOT NULL DEFAULT FALSE,
    is_adult_only       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_dlc              BOOLEAN         NOT NULL DEFAULT FALSE,
    is_software         BOOLEAN         NOT NULL DEFAULT FALSE,
    header_image_url    TEXT,
    trailer_steam_url   TEXT,
    steamspy_owners_est VARCHAR(50),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
-- 2. game_snapshots (일별 수집 스냅샷)
CREATE TABLE IF NOT EXISTS game_snapshots (
    snapshot_id         UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id              INTEGER         NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
    snapshot_date       DATE            NOT NULL,
    most_played_rank    SMALLINT,
    concurrent_users    INTEGER,
    peak_users_today    INTEGER,
    is_new_entry_mp     BOOLEAN         NOT NULL DEFAULT FALSE,
    wishlist_rank       SMALLINT,
    is_new_entry_wl     BOOLEAN         NOT NULL DEFAULT FALSE,
    rank_change_flag    VARCHAR(10),
    review_total        INTEGER,
    review_positive     INTEGER,
    review_negative     INTEGER,
    review_30d          INTEGER,
    review_spike        BOOLEAN         NOT NULL DEFAULT FALSE,
    forum_posts_24h     INTEGER,
    trailer_youtube_url TEXT,
    collected_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_snapshot  UNIQUE (app_id, snapshot_date),
    CONSTRAINT chk_mp_rank  CHECK (most_played_rank BETWEEN 1 AND 100),
    CONSTRAINT chk_wl_rank  CHECK (wishlist_rank    BETWEEN 1 AND 50),
    CONSTRAINT chk_flag     CHECK (rank_change_flag IN ('surge','drop','stable') OR rank_change_flag IS NULL)
);
-- 3. signals (신호 이벤트)
CREATE TYPE signal_type AS ENUM (
    'new_entry_mp', 'new_entry_wl', 'traffic_revival',
    'wishlist_surge', 'review_spike', 'composite'
);
CREATE TABLE IF NOT EXISTS signals (
    signal_id       UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    app_id          INTEGER         NOT NULL REFERENCES games(app_id) ON DELETE CASCADE,
    signal_date     DATE            NOT NULL,
    signal_type     signal_type     NOT NULL,
    composite_types signal_type[],
    priority        CHAR(2)         NOT NULL DEFAULT 'P0',
    payload         JSONB,
    notified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_signal    UNIQUE (app_id, signal_date, signal_type),
    CONSTRAINT chk_priority CHECK (priority IN ('P0','P1','P2'))
);
-- 4. notifications_log (알림 발송 이력)
CREATE TABLE IF NOT EXISTS notifications_log (
    id                BIGSERIAL       PRIMARY KEY,
    app_id            INTEGER         REFERENCES games(app_id),
    signal_id         UUID            REFERENCES signals(signal_id),
    notification_date DATE            NOT NULL,
    channel           VARCHAR(30)     NOT NULL,
    recipient         TEXT            NOT NULL,
    subject           TEXT,
    payload           JSONB,
    status            VARCHAR(20)     NOT NULL CHECK (status IN ('sent','failed','skipped')),
    error_message     TEXT,
    sent_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notif UNIQUE (app_id, notification_date, channel, recipient)
);
-- 5. pipeline_runs (배치 실행 이력)
CREATE TYPE run_status AS ENUM ('running', 'success', 'partial', 'failed');
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id          UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_date        DATE            NOT NULL,
    source          VARCHAR(50)     NOT NULL,
    status          run_status      NOT NULL DEFAULT 'running',
    started_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ,
    rows_collected  INTEGER         DEFAULT 0,
    rows_failed     INTEGER         DEFAULT 0,
    error_message   TEXT,
    retry_count     SMALLINT        NOT NULL DEFAULT 0,
    is_fallback     BOOLEAN         NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_run UNIQUE (run_date, source)
);
-- 6. daily_api_usage (API 할당량 추적)
CREATE TABLE IF NOT EXISTS daily_api_usage (
    usage_id        UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    usage_date      DATE            NOT NULL,
    api_name        VARCHAR(50)     NOT NULL,
    units_used      INTEGER         NOT NULL DEFAULT 0,
    units_limit     INTEGER,
    quota_exceeded  BOOLEAN         NOT NULL DEFAULT FALSE,
    recorded_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_usage UNIQUE (usage_date, api_name)
);
-- 뷰: 오늘의 신호 (대시보드용)
CREATE OR REPLACE VIEW v_today_signals AS
SELECT
    s.signal_id, s.signal_date, s.signal_type, s.priority,
    s.payload, s.composite_types, s.notified_at,
    g.app_id, g.title, g.developer, g.genres,
    g.header_image_url,
    snap.most_played_rank, snap.concurrent_users,
    snap.wishlist_rank, snap.rank_change_flag,
    snap.review_spike, snap.trailer_youtube_url
FROM signals s
JOIN games g ON g.app_id = s.app_id
LEFT JOIN game_snapshots snap
    ON snap.app_id = s.app_id AND snap.snapshot_date = s.signal_date
WHERE s.signal_date = CURRENT_DATE
ORDER BY
    CASE s.priority WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END,
    s.created_at DESC;
-- 뷰: 파이프라인 SLA 모니터링
CREATE OR REPLACE VIEW v_pipeline_sla AS
SELECT
    run_date, source, status,
    started_at, finished_at,
    EXTRACT(EPOCH FROM (finished_at - started_at))::INTEGER AS duration_sec,
    rows_collected, rows_failed, is_fallback, error_message
FROM pipeline_runs
WHERE run_date >= CURRENT_DATE - 7
ORDER BY run_date DESC, started_at DESC;
-- 인덱스
CREATE INDEX IF NOT EXISTS idx_snap_date     ON game_snapshots (snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_snap_app_date ON game_snapshots (app_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_sig_date      ON signals (signal_date DESC);
CREATE INDEX IF NOT EXISTS idx_sig_type      ON signals (signal_type, signal_date DESC);
