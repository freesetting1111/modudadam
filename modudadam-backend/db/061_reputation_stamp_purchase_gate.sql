BEGIN;

-- 선행·악행 포인트는 구매 자격만 해제합니다.
-- 스탬프 보유 여부는 stamp_purchase 거래가 실제로 생성된 뒤에만 인정합니다.
UPDATE attendance_stamp_catalog
SET price = CASE code
  WHEN 'kindness_100' THEN 100
  WHEN 'kindness_500' THEN 300
  WHEN 'kindness_1000' THEN 700
  WHEN 'kindness_5000' THEN 1500
  WHEN 'kindness_10000' THEN 3000
  WHEN 'misdeed_100' THEN 100
  WHEN 'misdeed_500' THEN 300
  WHEN 'misdeed_1000' THEN 700
  WHEN 'misdeed_5000' THEN 1500
  WHEN 'misdeed_10000' THEN 3000
  ELSE price
END
WHERE access_scope = 'reputation';

-- 이전 배포본이 이 함수를 호출하더라도 스탬프를 자동 지급하지 않도록
-- 함수 이름은 호환성 때문에 유지하고 동작만 중단합니다.
CREATE OR REPLACE FUNCTION grant_reputation_stamps(target_user_id uuid) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_reputation_points(user_id)
  VALUES(target_user_id)
  ON CONFLICT(user_id) DO NOTHING;
END $$;

COMMIT;
