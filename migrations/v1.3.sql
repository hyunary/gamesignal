-- game_snapshots에 역대 첫 진입 여부 컬럼 추가
ALTER TABLE game_snapshots
  ADD COLUMN IF NOT EXISTS is_first_ever_entry_mp BOOLEAN NOT NULL DEFAULT FALSE;

-- 기존 데이터 업데이트
-- 각 게임별 가장 첫 번째 most_played 스냅샷을 첫 진입으로 표시
UPDATE game_snapshots gs
SET is_first_ever_entry_mp = TRUE
WHERE is_new_entry_mp = TRUE
  AND snapshot_date = (
    SELECT MIN(snapshot_date)
    FROM game_snapshots
    WHERE app_id = gs.app_id
      AND most_played_rank IS NOT NULL
  );
