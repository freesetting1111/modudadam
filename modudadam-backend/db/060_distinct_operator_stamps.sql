BEGIN;

-- 운영자 전용 스탬프는 서로 다른 역할과 실루엣을 갖는 v4 이미지로 교체합니다.
-- 새 경로를 사용해 브라우저와 CDN에 남은 기존 v3 캐시도 분리합니다.
UPDATE attendance_stamp_catalog
SET
  emoji = CASE code
    WHEN 'operator_guardian' THEN '/brand/stamps/catalog/v4/operator-operator_guardian.svg'
    WHEN 'operator_starseed' THEN '/brand/stamps/catalog/v4/operator-operator_starseed.svg'
    WHEN 'operator_master' THEN '/brand/stamps/catalog/v4/operator-operator_master.svg'
  END,
  description = CASE code
    WHEN 'operator_guardian' THEN '청록빛 보호 결계로 모두다담을 지키는 운영자의 인장'
    WHEN 'operator_starseed' THEN '별의 궤도로 커뮤니티를 안내하는 희소한 운영자 표식'
    WHEN 'operator_master' THEN '왕관과 지휘 문장으로 단 하나의 최고 권한을 상징하는 최상위 스탬프'
  END,
  rarity = 'operator',
  access_scope = 'operator',
  enabled = true
WHERE code IN ('operator_guardian','operator_starseed','operator_master');

COMMIT;
