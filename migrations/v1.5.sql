-- ============================================================
-- GameSignal v1.5 — 판매량 예측 제안 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS forecast_suggestions (
  id            SERIAL        PRIMARY KEY,
  suggestion_type VARCHAR(20) NOT NULL CHECK (suggestion_type IN ('new_forecast', 'update_forecast')),
  game_title    TEXT          NOT NULL,
  reason        TEXT          NOT NULL,
  news_clip_ids INTEGER[],
  forecast_id   INTEGER,
  status        VARCHAR(20)   NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'dismissed')),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suggestions_status
  ON forecast_suggestions (status, created_at DESC);
