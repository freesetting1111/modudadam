BEGIN;

ALTER TABLE attendance_stamp_catalog
  DROP CONSTRAINT IF EXISTS attendance_stamp_catalog_access_scope_check;
ALTER TABLE attendance_stamp_catalog
  ADD CONSTRAINT attendance_stamp_catalog_access_scope_check
  CHECK (access_scope IN ('public','operator','achievement'));

INSERT INTO attendance_stamp_catalog
  (code,name,emoji,description,price,sort_order,rarity,enabled,access_scope)
VALUES
  ('reward_sprout_keeper','새싹지기','🌿','새싹 등급을 모두 모아 받은 컬렉션 완성 스탬프',0,2001,'uncommon',true,'achievement'),
  ('reward_daily_collector','일상 수집가','🧺','일반 등급을 모두 모아 받은 컬렉션 완성 스탬프',0,2002,'common',true,'achievement'),
  ('reward_rare_explorer','희귀 탐험가','🧭','희귀 등급을 모두 모아 받은 컬렉션 완성 스탬프',0,2003,'rare',true,'achievement'),
  ('reward_heroic_archivist','영웅 기록가','🏆✨','영웅 등급을 모두 모아 받은 컬렉션 완성 스탬프',0,2004,'epic',true,'achievement'),
  ('reward_legend_keeper','전설의 수호자','👑✨','전설 등급을 모두 모아 받은 컬렉션 완성 스탬프',0,2005,'legendary',true,'achievement'),
  ('reward_dadam_grandmaster','다담 그랜드 마스터','🌌👑','모든 공개 스탬프를 모아 받은 최종 컬렉션 완성 스탬프',0,2006,'mythic',true,'achievement')
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name,
  emoji=EXCLUDED.emoji,
  description=EXCLUDED.description,
  price=0,
  sort_order=EXCLUDED.sort_order,
  rarity=EXCLUDED.rarity,
  enabled=true,
  access_scope='achievement';

ALTER TABLE stamp_collection_title_catalog
  ADD COLUMN IF NOT EXISTS reward_stamp_code varchar(30)
  REFERENCES attendance_stamp_catalog(code);

UPDATE stamp_collection_title_catalog
SET reward_stamp_code = CASE code
  WHEN 'sprout_keeper' THEN 'reward_sprout_keeper'
  WHEN 'daily_collector' THEN 'reward_daily_collector'
  WHEN 'rare_explorer' THEN 'reward_rare_explorer'
  WHEN 'heroic_archivist' THEN 'reward_heroic_archivist'
  WHEN 'legend_keeper' THEN 'reward_legend_keeper'
  WHEN 'dadam_grandmaster' THEN 'reward_dadam_grandmaster'
END
WHERE code IN (
  'sprout_keeper','daily_collector','rare_explorer',
  'heroic_archivist','legend_keeper','dadam_grandmaster'
);

COMMIT;
