BEGIN;

CREATE TABLE IF NOT EXISTS acorn_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id),
  recipient_id uuid NOT NULL REFERENCES users(id),
  amount integer NOT NULL CHECK (amount BETWEEN 1 AND 9999),
  message varchar(80),
  request_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id),
  UNIQUE(sender_id, request_key)
);

CREATE INDEX IF NOT EXISTS acorn_gifts_sender_idx
  ON acorn_gifts(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS acorn_gifts_recipient_idx
  ON acorn_gifts(recipient_id, created_at DESC);

ALTER TABLE acorn_transactions
  DROP CONSTRAINT IF EXISTS acorn_transactions_transaction_type_check;
ALTER TABLE acorn_transactions
  ADD CONSTRAINT acorn_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'attendance','attendance_bonus','challenge_checkin','challenge_complete',
    'mission_complete','stamp_purchase','gift_sent','gift_received'
  ));

COMMIT;
