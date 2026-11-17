BEGIN;

CREATE TABLE IF NOT EXISTS visitor_presence (
  identity_key VARCHAR(80) PRIMARY KEY,
  anonymous_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ip_hash CHAR(64),
  last_path TEXT,
  user_agent TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT visitor_presence_identity_check CHECK (anonymous_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS visitor_presence_last_seen_idx
  ON visitor_presence(last_seen_at DESC);

COMMIT;
