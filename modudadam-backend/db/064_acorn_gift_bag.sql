BEGIN;

ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS gift_type varchar(20);
ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS status varchar(20);
ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS sender_display_name varchar(60);

-- 기존 선물은 이미 받는 사람의 지갑에 지급된 데이터이므로 수령 완료로 이관합니다.
UPDATE acorn_gifts
SET gift_type=COALESCE(gift_type,'user'),
    status=COALESCE(status,'claimed'),
    claimed_at=CASE
      WHEN COALESCE(status,'claimed')='claimed' THEN COALESCE(claimed_at,created_at)
      ELSE claimed_at
    END;

ALTER TABLE acorn_gifts ALTER COLUMN gift_type SET DEFAULT 'user';
ALTER TABLE acorn_gifts ALTER COLUMN gift_type SET NOT NULL;
ALTER TABLE acorn_gifts ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE acorn_gifts ALTER COLUMN status SET NOT NULL;
ALTER TABLE acorn_gifts ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE acorn_gifts DROP CONSTRAINT IF EXISTS acorn_gifts_gift_type_check;
ALTER TABLE acorn_gifts ADD CONSTRAINT acorn_gifts_gift_type_check
  CHECK (gift_type IN ('user','signup_package'));
ALTER TABLE acorn_gifts DROP CONSTRAINT IF EXISTS acorn_gifts_status_check;
ALTER TABLE acorn_gifts ADD CONSTRAINT acorn_gifts_status_check
  CHECK (status IN ('pending','claimed'));
ALTER TABLE acorn_gifts DROP CONSTRAINT IF EXISTS acorn_gifts_sender_identity_check;
ALTER TABLE acorn_gifts ADD CONSTRAINT acorn_gifts_sender_identity_check
  CHECK (sender_id IS NOT NULL OR length(trim(COALESCE(sender_display_name,'')))>0);

CREATE INDEX IF NOT EXISTS acorn_gifts_pending_recipient_idx
  ON acorn_gifts(recipient_id,created_at DESC) WHERE status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS acorn_gifts_signup_package_once_idx
  ON acorn_gifts(recipient_id,gift_type) WHERE gift_type='signup_package';

COMMIT;
