BEGIN;

-- 선물 전송 상태를 발신자와 수신자가 확인할 수 있도록 단계별 시각을 보존합니다.
ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS viewed_at timestamptz;
ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS failed_at timestamptz;
ALTER TABLE acorn_gifts ADD COLUMN IF NOT EXISTS failure_reason varchar(200);

ALTER TABLE acorn_gifts DROP CONSTRAINT IF EXISTS acorn_gifts_status_check;

-- 기존 미수령 선물은 전송 자체는 끝난 상태이므로 전송완료로 이관합니다.
UPDATE acorn_gifts
SET status='sent',
    sent_at=COALESCE(sent_at,created_at)
WHERE status='pending';

UPDATE acorn_gifts
SET sent_at=COALESCE(sent_at,created_at)
WHERE status IN ('sent','viewed','claimed');

UPDATE acorn_gifts
SET viewed_at=COALESCE(viewed_at,claimed_at,created_at)
WHERE status='claimed';

ALTER TABLE acorn_gifts ALTER COLUMN status SET DEFAULT 'sending';
ALTER TABLE acorn_gifts ADD CONSTRAINT acorn_gifts_status_check
  CHECK (status IN ('sending','sent','viewed','claimed','failed'));

DROP INDEX IF EXISTS acorn_gifts_pending_recipient_idx;
CREATE INDEX IF NOT EXISTS acorn_gifts_unclaimed_recipient_idx
  ON acorn_gifts(recipient_id,created_at DESC)
  WHERE status IN ('sending','sent','viewed');

CREATE INDEX IF NOT EXISTS acorn_gifts_sender_status_idx
  ON acorn_gifts(sender_id,status,created_at DESC);

COMMIT;
