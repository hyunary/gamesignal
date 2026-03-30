-- ============================================================
-- GameSignal v1.4 — 인벤 뉴스 클리핑 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS news_clips (
    id              SERIAL          PRIMARY KEY,
    clip_date       DATE            NOT NULL,
    category        VARCHAR(20)     NOT NULL CHECK (category IN ('business', 'newgame')),
    importance      VARCHAR(10)     NOT NULL CHECK (importance IN ('high', 'medium', 'low')),
    title           TEXT            NOT NULL,
    summary         TEXT            NOT NULL,
    analyst_comment TEXT,
    source_url      TEXT,
    related_ticker  VARCHAR(20),
    related_company VARCHAR(100),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_clip UNIQUE (clip_date, title)
);

CREATE TABLE IF NOT EXISTS news_summaries (
    id          SERIAL      PRIMARY KEY,
    clip_date   DATE        NOT NULL UNIQUE,
    summary     TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_date ON news_clips (clip_date DESC);
