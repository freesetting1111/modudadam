BEGIN;

ALTER TABLE account_recovery_codes
  DROP CONSTRAINT IF EXISTS account_recovery_codes_purpose_check;

ALTER TABLE account_recovery_codes
  ADD COLUMN IF NOT EXISTS email_address varchar(320);

ALTER TABLE account_recovery_codes
  ADD CONSTRAINT account_recovery_codes_purpose_check
  CHECK(purpose IN ('find_id','password_reset'));

CREATE INDEX IF NOT EXISTS account_recovery_codes_email_idx
  ON account_recovery_codes(lower(email_address), purpose, created_at DESC)
  WHERE consumed_at IS NULL;

COMMIT;
