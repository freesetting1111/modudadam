BEGIN;

CREATE TABLE IF NOT EXISTS account_recovery_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose varchar(30) NOT NULL DEFAULT 'password_reset' CHECK(purpose IN ('password_reset')),
  code_hash char(64) NOT NULL,
  attempt_count smallint NOT NULL DEFAULT 0 CHECK(attempt_count >= 0),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_recovery_codes_active_idx
  ON account_recovery_codes(user_id, purpose, created_at DESC)
  WHERE consumed_at IS NULL;

COMMIT;
