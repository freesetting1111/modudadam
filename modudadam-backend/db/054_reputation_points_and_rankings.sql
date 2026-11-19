BEGIN;

-- 스탬프를 이모지뿐 아니라 프로젝트 이미지 경로로도 표시할 수 있게 확장합니다.
ALTER TABLE attendance_stamp_catalog ALTER COLUMN emoji TYPE varchar(160);
ALTER TABLE attendance_stamp_catalog
  DROP CONSTRAINT IF EXISTS attendance_stamp_catalog_access_scope_check;
ALTER TABLE attendance_stamp_catalog
  ADD CONSTRAINT attendance_stamp_catalog_access_scope_check
  CHECK (access_scope IN ('public','operator','achievement','reputation'));

CREATE TABLE IF NOT EXISTS user_reputation_points (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  kindness_points integer NOT NULL DEFAULT 0 CHECK (kindness_points BETWEEN 0 AND 20000),
  misdeed_points integer NOT NULL DEFAULT 0 CHECK (misdeed_points BETWEEN 0 AND 20000),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reputation_point_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  point_type varchar(20) NOT NULL CHECK (point_type IN ('kindness','misdeed')),
  amount integer NOT NULL CHECK (amount > 0),
  source_type varchar(40) NOT NULL,
  source_key varchar(120) NOT NULL,
  description varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,point_type,source_type,source_key)
);
CREATE INDEX IF NOT EXISTS reputation_point_ledger_weekly_idx
  ON reputation_point_ledger(point_type,created_at DESC,user_id);

CREATE TABLE IF NOT EXISTS weekly_misdeed_votes (
  week_start date NOT NULL,
  voter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(week_start,voter_id),
  CHECK (voter_id <> candidate_user_id)
);
CREATE INDEX IF NOT EXISTS weekly_misdeed_votes_candidate_idx
  ON weekly_misdeed_votes(week_start,candidate_user_id);

CREATE TABLE IF NOT EXISTS weekly_misdeed_awards (
  week_start date NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  final_rank smallint NOT NULL CHECK (final_rank BETWEEN 1 AND 5),
  vote_count integer NOT NULL CHECK (vote_count >= 0),
  points_awarded smallint NOT NULL CHECK (points_awarded BETWEEN 1 AND 5),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(week_start,user_id)
);

INSERT INTO attendance_stamp_catalog
  (code,name,emoji,description,price,sort_order,rarity,enabled,access_scope)
VALUES
  ('kindness_100','온기의 불씨','/brand/stamps/reputation-kind.svg','선행 포인트 100점을 기록한 따뜻한 시작',0,3101,'uncommon',true,'reputation'),
  ('kindness_500','선의의 파수꾼','/brand/stamps/reputation-kind.svg','선행 포인트 500점을 기록한 다정한 수호자',0,3102,'common',true,'reputation'),
  ('kindness_1000','은빛 가교','/brand/stamps/reputation-kind.svg','선행 포인트 1,000점으로 사람을 이어 준 증표',0,3103,'rare',true,'reputation'),
  ('kindness_5000','황금 심장','/brand/stamps/reputation-kind.svg','선행 포인트 5,000점을 밝힌 황금빛 마음',0,3104,'legendary',true,'reputation'),
  ('kindness_10000','찬란한 성좌','/brand/stamps/reputation-kind.svg','선행 포인트 10,000점으로 완성한 선의의 성좌',0,3105,'mythic',true,'reputation'),
  ('misdeed_100','주의의 흔적','/brand/stamps/reputation-warning.svg','악행 포인트 100점에 도달한 주의 기록',0,3201,'uncommon',true,'reputation'),
  ('misdeed_500','붉은 경고','/brand/stamps/reputation-warning.svg','악행 포인트 500점에 도달한 경고 기록',0,3202,'common',true,'reputation'),
  ('misdeed_1000','금단의 가면','/brand/stamps/reputation-warning.svg','악행 포인트 1,000점에 도달한 불명예 기록',0,3203,'rare',true,'reputation'),
  ('misdeed_5000','심연의 낙인','/brand/stamps/reputation-warning.svg','악행 포인트 5,000점에 도달한 깊은 경고',0,3204,'legendary',true,'reputation'),
  ('misdeed_10000','혼돈의 왕관','/brand/stamps/reputation-warning.svg','악행 포인트 10,000점에 도달한 최종 경고',0,3205,'mythic',true,'reputation')
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name,emoji=EXCLUDED.emoji,description=EXCLUDED.description,
  price=0,sort_order=EXCLUDED.sort_order,rarity=EXCLUDED.rarity,
  enabled=true,access_scope='reputation';

-- 기존 스탬프도 등급별 벡터 엠블럼으로 통일합니다.
UPDATE attendance_stamp_catalog
SET emoji = CASE rarity
  WHEN 'uncommon' THEN '/brand/stamps/tier-uncommon.svg'
  WHEN 'common' THEN '/brand/stamps/tier-common.svg'
  WHEN 'rare' THEN '/brand/stamps/tier-rare.svg'
  WHEN 'epic' THEN '/brand/stamps/tier-epic.svg'
  WHEN 'legendary' THEN '/brand/stamps/tier-legendary.svg'
  WHEN 'mythic' THEN '/brand/stamps/tier-mythic.svg'
  WHEN 'operator' THEN '/brand/stamps/tier-operator.svg'
  ELSE emoji
END
WHERE access_scope IN ('public','achievement','operator')
  AND rarity IN ('uncommon','common','rare','epic','legendary','mythic','operator');

UPDATE attendance_stamp_catalog
SET emoji='/brand/stamps/first-footprint.svg'
WHERE code='basic';

CREATE OR REPLACE FUNCTION grant_reputation_stamps(target_user_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  kindness integer := 0;
  misdeed integer := 0;
BEGIN
  INSERT INTO user_reputation_points(user_id) VALUES(target_user_id)
  ON CONFLICT(user_id) DO NOTHING;
  SELECT kindness_points,misdeed_points INTO kindness,misdeed
  FROM user_reputation_points WHERE user_id=target_user_id;

  INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped)
  SELECT target_user_id,catalog.code,false
  FROM attendance_stamp_catalog catalog
  WHERE catalog.access_scope='reputation' AND catalog.enabled AND (
    (catalog.code='kindness_100' AND kindness>=100) OR
    (catalog.code='kindness_500' AND kindness>=500) OR
    (catalog.code='kindness_1000' AND kindness>=1000) OR
    (catalog.code='kindness_5000' AND kindness>=5000) OR
    (catalog.code='kindness_10000' AND kindness>=10000) OR
    (catalog.code='misdeed_100' AND misdeed>=100) OR
    (catalog.code='misdeed_500' AND misdeed>=500) OR
    (catalog.code='misdeed_1000' AND misdeed>=1000) OR
    (catalog.code='misdeed_5000' AND misdeed>=5000) OR
    (catalog.code='misdeed_10000' AND misdeed>=10000)
  )
  ON CONFLICT(user_id,stamp_code) DO NOTHING;
END $$;

COMMIT;
