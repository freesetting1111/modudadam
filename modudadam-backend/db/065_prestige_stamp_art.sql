BEGIN;

-- 선행·악행 5천/1만 포인트 스탬프를 전설·신화 단계에 맞는 전용 아트로 교체합니다.
-- 새 경로를 사용해 배포/CDN 캐시에 남은 이전 SVG도 즉시 갱신되도록 합니다.
UPDATE attendance_stamp_catalog
SET emoji = CASE code
  WHEN 'kindness_5000' THEN '/brand/stamps/catalog/v7/legendary-kindness_5000.svg'
  WHEN 'kindness_10000' THEN '/brand/stamps/catalog/v7/mythic-kindness_10000.svg'
  WHEN 'misdeed_5000' THEN '/brand/stamps/catalog/v7/legendary-misdeed_5000.svg'
  WHEN 'misdeed_10000' THEN '/brand/stamps/catalog/v7/mythic-misdeed_10000.svg'
END,
description = CASE code
  WHEN 'kindness_5000' THEN '선행 포인트 5,000점 · 오랜 선행으로 완성한 전설의 황금 심장'
  WHEN 'kindness_10000' THEN '선행 포인트 10,000점 · 모두의 밤을 밝히는 신화의 선의 성좌'
  WHEN 'misdeed_5000' THEN '악행 포인트 5,000점 · 공동체의 깊은 경고가 새겨진 심연의 낙인'
  WHEN 'misdeed_10000' THEN '악행 포인트 10,000점 · 최종 단계의 불명예를 상징하는 혼돈의 왕관'
END
WHERE code IN ('kindness_5000','kindness_10000','misdeed_5000','misdeed_10000')
  AND access_scope = 'reputation';

COMMIT;
