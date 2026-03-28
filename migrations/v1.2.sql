-- YouTube 댓글 감성 분석 결과 저장
CREATE TABLE IF NOT EXISTS youtube_sentiment (
    id              SERIAL          PRIMARY KEY,
    app_id          INTEGER         NOT NULL REFERENCES games(app_id),
    analysis_date   DATE            NOT NULL,
    video_id        VARCHAR(20)     NOT NULL,
    video_title     TEXT,
    video_url       TEXT,
    comments_total  INTEGER         DEFAULT 0,
    positive_count  INTEGER         DEFAULT 0,
    neutral_count   INTEGER         DEFAULT 0,
    negative_count  INTEGER         DEFAULT 0,
    positive_pct    NUMERIC(5,2),
    neutral_pct     NUMERIC(5,2),
    negative_pct    NUMERIC(5,2),
    top_keywords    TEXT[],
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sentiment UNIQUE (app_id, analysis_date, video_id)
);

CREATE INDEX IF NOT EXISTS idx_sentiment_app_date
    ON youtube_sentiment (app_id, analysis_date DESC);
