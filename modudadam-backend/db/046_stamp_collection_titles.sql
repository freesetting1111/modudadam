BEGIN;

-- 기본 제공 새싹 스탬프를 첫 발자국 바로 다음에 표시합니다.
UPDATE attendance_stamp_catalog AS catalog
SET sort_order = ordered.sort_order
FROM (
  SELECT code,ordinality::smallint AS sort_order
  FROM unnest(ARRAY[
    'basic','sprout','acorn','clover','sun','moon','flower','cloud','leaf','coffee',
    'bread','heart','star','cat','dog','rabbit','squirrel','cherry','lemon','tulip',
    'maple','snow','umbrella','rainbow','butterfly','bee','ladybug','whale','dolphin','penguin'
  ]::varchar[]) WITH ORDINALITY AS stamp_order(code,ordinality)
) AS ordered
WHERE catalog.code = ordered.code;

CREATE TABLE IF NOT EXISTS stamp_collection_title_catalog (
  code varchar(40) PRIMARY KEY,
  name varchar(40) NOT NULL,
  emoji varchar(16) NOT NULL,
  description varchar(120) NOT NULL,
  required_rarity varchar(20) NOT NULL,
  requires_all_public boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  CONSTRAINT stamp_collection_title_rarity_check
    CHECK (required_rarity IN ('uncommon','common','rare','epic','legendary','mythic'))
);

INSERT INTO stamp_collection_title_catalog
  (code,name,emoji,description,required_rarity,requires_all_public,sort_order)
VALUES
  ('sprout_keeper','새싹지기','🌱','새싹 등급 스탬프를 모두 모은 다정한 수집가','uncommon',false,1),
  ('daily_collector','일상 수집가','🧺','일반 등급 스탬프를 모두 모아 일상의 조각을 완성한 수집가','common',false,2),
  ('rare_explorer','희귀 탐험가','🧭','희귀 등급 스탬프를 모두 발견한 특별한 탐험가','rare',false,3),
  ('heroic_archivist','영웅 기록가','🏆','영웅 등급 스탬프를 모두 모아 빛나는 기록을 완성한 수집가','epic',false,4),
  ('legend_keeper','전설의 수호자','👑','전설 등급 스탬프를 모두 소유한 도토리 왕국의 수호자','legendary',false,5),
  ('dadam_grandmaster','다담 그랜드 마스터','🌌','모든 공개 스탬프를 수집해 모두다담의 여정을 완성한 최종 수집가','mythic',true,6)
ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name,
  emoji=EXCLUDED.emoji,
  description=EXCLUDED.description,
  required_rarity=EXCLUDED.required_rarity,
  requires_all_public=EXCLUDED.requires_all_public,
  sort_order=EXCLUDED.sort_order,
  enabled=true;

COMMIT;
