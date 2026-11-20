BEGIN;

-- 최상위 선행·악행 스탬프 가격을 획득 단계에 맞게 조정합니다.
UPDATE attendance_stamp_catalog
SET price = CASE code
  WHEN 'kindness_5000' THEN 5000
  WHEN 'kindness_10000' THEN 10000
  WHEN 'misdeed_5000' THEN 5000
  WHEN 'misdeed_10000' THEN 10000
END
WHERE code IN ('kindness_5000','kindness_10000','misdeed_5000','misdeed_10000')
  AND access_scope = 'reputation';

-- 10,000개 스탬프를 실제 구매할 수 있도록 도토리 보유 한도를 확장합니다.
ALTER TABLE acorn_wallets DROP CONSTRAINT IF EXISTS acorn_wallets_balance_check;
ALTER TABLE acorn_wallets ADD CONSTRAINT acorn_wallets_balance_check
  CHECK (balance BETWEEN 0 AND 20000);

-- 도토리 차감 내역을 일반 구매와 구분해 영구 기록합니다.
ALTER TABLE acorn_transactions DROP CONSTRAINT IF EXISTS acorn_transactions_transaction_type_check;
ALTER TABLE acorn_transactions ADD CONSTRAINT acorn_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'attendance','attendance_bonus','challenge_checkin','challenge_complete',
    'mission_complete','stamp_purchase','gift_sent','gift_received',
    'detective_reward','misdeed_conversion'
  ));

COMMIT;
