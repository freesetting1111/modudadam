BEGIN;

ALTER TABLE local_treasures
  ADD COLUMN IF NOT EXISTS kakao_place_id varchar(30),
  ADD COLUMN IF NOT EXISTS road_address varchar(300),
  ADD COLUMN IF NOT EXISTS place_url varchar(500);

CREATE INDEX IF NOT EXISTS local_treasures_kakao_place_id_idx
  ON local_treasures(kakao_place_id)
  WHERE status = 'published' AND kakao_place_id IS NOT NULL;

COMMIT;
