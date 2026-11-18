BEGIN;

ALTER TABLE attendance_stamp_catalog
  ADD COLUMN IF NOT EXISTS access_scope varchar(20) NOT NULL DEFAULT 'public';

ALTER TABLE attendance_stamp_catalog
  DROP CONSTRAINT IF EXISTS attendance_stamp_catalog_access_scope_check;
ALTER TABLE attendance_stamp_catalog
  ADD CONSTRAINT attendance_stamp_catalog_access_scope_check
  CHECK (access_scope IN ('public','operator'));

INSERT INTO attendance_stamp_catalog
  (code,name,emoji,description,price,sort_order,rarity,enabled,access_scope)
VALUES
  ('operator_guardian','다담 수호자의 인장','🛡️','모두다담을 지키는 운영자에게만 주어지는 인장',0,1001,'operator',true,'operator'),
  ('operator_starseed','별을 품은 운영자','⚜️','커뮤니티의 밤을 밝히는 희소한 운영자 표식',0,1002,'operator',true,'operator'),
  ('operator_master','모두다담 총관리자','🦉','단 하나의 운영 권한을 상징하는 최상위 스탬프',0,1003,'operator',true,'operator')
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,emoji=EXCLUDED.emoji,description=EXCLUDED.description,
  price=EXCLUDED.price,sort_order=EXCLUDED.sort_order,rarity=EXCLUDED.rarity,
  enabled=true,access_scope='operator';

INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped)
SELECT users.id,catalog.code,false
FROM users
CROSS JOIN attendance_stamp_catalog catalog
WHERE lower(users.email)='freesetting@naver.com'
  AND users.deleted_at IS NULL
  AND catalog.access_scope='operator'
ON CONFLICT(user_id,stamp_code) DO NOTHING;

COMMIT;
