BEGIN;

ALTER TABLE search_logs
  ADD COLUMN IF NOT EXISTS anonymous_id UUID;

CREATE INDEX IF NOT EXISTS search_logs_anonymous_query_recent_idx
  ON search_logs(anonymous_id, query, created_at DESC)
  WHERE anonymous_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS search_logs_user_query_recent_idx
  ON search_logs(user_id, query, created_at DESC)
  WHERE user_id IS NOT NULL;

COMMIT;
