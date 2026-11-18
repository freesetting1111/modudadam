BEGIN;

UPDATE attendance_stamp_catalog SET
  emoji=CASE code
    WHEN 'operator_guardian' THEN '🛡️'
    WHEN 'operator_starseed' THEN '⚜️'
    WHEN 'operator_master' THEN '🦉'
    ELSE emoji END
WHERE code IN ('operator_guardian','operator_starseed','operator_master');

-- 새싹을 첫 등급, 일반을 두 번째 등급으로 재배치합니다.
UPDATE attendance_stamp_catalog SET rarity='uncommon'
WHERE code IN ('basic','sprout','acorn','clover','sun','moon','flower','cloud','leaf','coffee','bread','heart','star','cat','dog','rabbit','squirrel','cherry','lemon');
UPDATE attendance_stamp_catalog SET rarity='common'
WHERE code IN ('tulip','maple','snow','umbrella','rainbow','butterfly','bee','ladybug','whale','dolphin','penguin');

UPDATE attendance_stamp_catalog SET price=0 WHERE code IN ('basic','sprout');
WITH ranked AS (
  SELECT code,rarity,row_number() OVER(PARTITION BY rarity ORDER BY sort_order) AS rn
  FROM attendance_stamp_catalog WHERE access_scope='public' AND price>0 AND rarity IN ('uncommon','common')
)
UPDATE attendance_stamp_catalog catalog SET price=CASE ranked.rarity
  WHEN 'uncommon' THEN 10+(ranked.rn-1)*5
  WHEN 'common' THEN 80+(ranked.rn-1)*15 END
FROM ranked WHERE catalog.code=ranked.code;

INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped)
SELECT id,'sprout',false FROM users WHERE deleted_at IS NULL
ON CONFLICT(user_id,stamp_code) DO NOTHING;

UPDATE acorn_wallets SET balance=LEAST(balance,9999);
ALTER TABLE acorn_wallets DROP CONSTRAINT IF EXISTS acorn_wallets_balance_check;
ALTER TABLE acorn_wallets ADD CONSTRAINT acorn_wallets_balance_check CHECK (balance BETWEEN 0 AND 9999);

ALTER TABLE attendance_checkins DROP CONSTRAINT IF EXISTS attendance_checkins_acorns_earned_check;
ALTER TABLE attendance_checkins ADD CONSTRAINT attendance_checkins_acorns_earned_check CHECK (acorns_earned BETWEEN 0 AND 20);

COMMIT;
