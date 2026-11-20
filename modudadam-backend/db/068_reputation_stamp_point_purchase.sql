BEGIN;

-- 선행·악행 포인트는 획득뿐 아니라 특별 스탬프 구매에 사용하는 재화입니다.
-- 차감 내역도 같은 원장에 음수로 남겨 원본 이력을 보존합니다.
ALTER TABLE reputation_point_ledger
  DROP CONSTRAINT IF EXISTS reputation_point_ledger_amount_check;
ALTER TABLE reputation_point_ledger
  ADD CONSTRAINT reputation_point_ledger_amount_check CHECK (amount <> 0);

-- 각 특별 스탬프의 실제 포인트 구매 가격입니다.
UPDATE attendance_stamp_catalog
SET price = CASE code
  WHEN 'kindness_100' THEN 100
  WHEN 'kindness_500' THEN 300
  WHEN 'kindness_1000' THEN 700
  WHEN 'kindness_5000' THEN 5000
  WHEN 'kindness_10000' THEN 10000
  WHEN 'misdeed_100' THEN 100
  WHEN 'misdeed_500' THEN 300
  WHEN 'misdeed_1000' THEN 700
  WHEN 'misdeed_5000' THEN 5000
  WHEN 'misdeed_10000' THEN 10000
  ELSE price
END
WHERE access_scope='reputation';

COMMIT;
