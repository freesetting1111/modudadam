BEGIN;

CREATE TABLE IF NOT EXISTS oauth_login_tickets (
  token_hash char(64) PRIMARY KEY,
  provider oauth_provider NOT NULL,
  provider_user_id varchar(255) NOT NULL,
  profile jsonb NOT NULL,
  return_to text NOT NULL DEFAULT '/',
  requires_agreement boolean NOT NULL DEFAULT true,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS oauth_login_tickets_expires_idx
  ON oauth_login_tickets(expires_at);

CREATE TABLE IF NOT EXISTS user_consents (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_key varchar(50) NOT NULL,
  consent_version varchar(20) NOT NULL,
  agreed boolean NOT NULL,
  user_agent text,
  agreed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, consent_key, consent_version)
);
CREATE INDEX IF NOT EXISTS user_consents_user_idx ON user_consents(user_id, agreed_at DESC);

COMMIT;
