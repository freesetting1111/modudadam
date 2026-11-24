BEGIN;

-- 일반 수집, 선행·악행, 등급 완성 칭호를 동일한 v8 계단형 디자인 체계로 전환합니다.
-- 운영자 전용 스탬프는 기존 전용 아트(황금 다람쥐 포함)를 유지합니다.
UPDATE attendance_stamp_catalog
SET emoji = '/brand/stamps/catalog/v8/' || rarity || '-' || code || '.svg'
WHERE enabled
  AND access_scope IN ('public','achievement','reputation')
  AND rarity IN ('uncommon','common','rare','epic','legendary','mythic');

COMMIT;
