BEGIN;

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

-- 선행·악행 스탬프와 기존에 합의한 단계별 조건을 다시 보장합니다.
INSERT INTO attendance_stamp_catalog
  (code,name,emoji,description,price,sort_order,rarity,enabled,access_scope)
VALUES
  ('kindness_100','온기의 불씨','/brand/stamps/catalog/v3/uncommon-kindness_100.svg','선행 포인트 100점 · 따뜻한 마음이 처음 빛난 증표',0,3101,'uncommon',true,'reputation'),
  ('kindness_500','선의의 파수꾼','/brand/stamps/catalog/v3/common-kindness_500.svg','선행 포인트 500점 · 다정한 행동을 꾸준히 지킨 증표',0,3102,'common',true,'reputation'),
  ('kindness_1000','은빛 가교','/brand/stamps/catalog/v3/rare-kindness_1000.svg','선행 포인트 1,000점 · 사람과 사람을 이어 준 증표',0,3103,'rare',true,'reputation'),
  ('kindness_5000','황금 심장','/brand/stamps/catalog/v3/legendary-kindness_5000.svg','선행 포인트 5,000점 · 오랜 선행으로 완성한 황금빛 마음',0,3104,'legendary',true,'reputation'),
  ('kindness_10000','찬란한 성좌','/brand/stamps/catalog/v3/mythic-kindness_10000.svg','선행 포인트 10,000점 · 모두의 밤을 밝히는 선의의 성좌',0,3105,'mythic',true,'reputation'),
  ('misdeed_100','주의의 흔적','/brand/stamps/catalog/v3/uncommon-misdeed_100.svg','악행 포인트 100점 · 공동체의 주의가 필요한 첫 기록',0,3201,'uncommon',true,'reputation'),
  ('misdeed_500','붉은 경고','/brand/stamps/catalog/v3/common-misdeed_500.svg','악행 포인트 500점 · 반복된 문제 행동에 남은 경고',0,3202,'common',true,'reputation'),
  ('misdeed_1000','금단의 가면','/brand/stamps/catalog/v3/rare-misdeed_1000.svg','악행 포인트 1,000점 · 신뢰를 잃은 행동의 기록',0,3203,'rare',true,'reputation'),
  ('misdeed_5000','심연의 낙인','/brand/stamps/catalog/v3/legendary-misdeed_5000.svg','악행 포인트 5,000점 · 깊어진 경고를 상징하는 낙인',0,3204,'legendary',true,'reputation'),
  ('misdeed_10000','혼돈의 왕관','/brand/stamps/catalog/v3/mythic-misdeed_10000.svg','악행 포인트 10,000점 · 최종 단계의 불명예 기록',0,3205,'mythic',true,'reputation')
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name,emoji=EXCLUDED.emoji,description=EXCLUDED.description,
  price=0,sort_order=EXCLUDED.sort_order,rarity=EXCLUDED.rarity,
  enabled=true,access_scope='reputation';

-- 등급별 외곽 실루엣이 성장하는 v3 이미지로 교체하고 CDN 캐시를 분리합니다.
UPDATE attendance_stamp_catalog
SET emoji = '/brand/stamps/catalog/v3/' || rarity || '-' || code || '.svg'
WHERE enabled
  AND code IN (
    'basic','sprout','acorn','clover','sun','moon','flower','cloud','leaf','coffee','bread','heart','star','cat','dog','rabbit','squirrel','cherry','lemon',
    'tulip','maple','snow','umbrella','rainbow','butterfly','bee','ladybug','whale','dolphin','penguin',
    'fox','owl','panda','unicorn','rocket','planet','comet','crystal','crown','fire',
    'purple_heart','blue_heart','magic','artist','music','trophy','medal','galaxy','phoenix','royal_squirrel','aurora_crown','modudadam_master',
    'operator_guardian','operator_starseed','operator_master',
    'reward_sprout_keeper','reward_daily_collector','reward_rare_explorer','reward_heroic_archivist','reward_legend_keeper','reward_dadam_grandmaster',
    'kindness_100','kindness_500','kindness_1000','kindness_5000','kindness_10000',
    'misdeed_100','misdeed_500','misdeed_1000','misdeed_5000','misdeed_10000'
  );

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

-- 이미 조건을 달성한 계정도 다음 방문을 기다리지 않고 소급 지급합니다.
SELECT grant_reputation_stamps(user_id) FROM user_reputation_points;

COMMIT;
