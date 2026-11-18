BEGIN;

-- 첫 발자국과 새싹은 새싹 등급에 유지하고,
-- 기존 일반 스탬프는 새싹 등급으로 이동합니다.
UPDATE attendance_stamp_catalog
SET rarity = 'uncommon'
WHERE code IN (
  'basic','sprout','acorn','clover','sun','moon','flower','cloud','leaf',
  'coffee','bread','heart','star','cat','dog','rabbit','squirrel','cherry','lemon'
);

-- 기존 새싹 스탬프 중 새싹 자체를 제외한 항목은 일반 등급으로 이동합니다.
UPDATE attendance_stamp_catalog
SET rarity = 'common'
WHERE code IN (
  'tulip','maple','snow','umbrella','rainbow','butterfly',
  'bee','ladybug','whale','dolphin','penguin'
);

-- 기본 제공되는 첫 발자국과 새싹은 무료로 유지합니다.
UPDATE attendance_stamp_catalog
SET price = 0
WHERE code IN ('basic','sprout');

-- 변경된 등급 순서에 맞춰 가격도 다시 정렬합니다.
WITH ranked AS (
  SELECT
    code,
    rarity,
    row_number() OVER (PARTITION BY rarity ORDER BY sort_order) AS tier_order
  FROM attendance_stamp_catalog
  WHERE access_scope = 'public'
    AND code NOT IN ('basic','sprout')
    AND rarity IN ('uncommon','common')
)
UPDATE attendance_stamp_catalog AS catalog
SET price = CASE ranked.rarity
  WHEN 'uncommon' THEN 10 + (ranked.tier_order - 1) * 5
  WHEN 'common' THEN 80 + (ranked.tier_order - 1) * 15
END
FROM ranked
WHERE catalog.code = ranked.code;

COMMIT;
