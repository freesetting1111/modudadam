BEGIN;

CREATE TABLE IF NOT EXISTS daily_visitors (
  visit_date DATE NOT NULL,
  identity_key VARCHAR(80) NOT NULL,
  anonymous_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_path TEXT,
  user_agent TEXT,
  PRIMARY KEY (visit_date, identity_key),
  CONSTRAINT daily_visitors_identity_check CHECK (anonymous_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS daily_visitors_last_seen_idx
  ON daily_visitors(visit_date, last_seen_at DESC);

-- 배포 당일 이미 쌓인 접근 로그를 한국 시간 기준 오늘 방문자로 채웁니다.
WITH bounds AS (
  SELECT
    (NOW() AT TIME ZONE 'Asia/Seoul')::DATE AS visit_date,
    ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE::TIMESTAMP AT TIME ZONE 'Asia/Seoul') AS starts_at,
    ((((NOW() AT TIME ZONE 'Asia/Seoul')::DATE + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Seoul') AS ends_at
), today_logs AS (
  SELECT logs.*
  FROM access_logs logs CROSS JOIN bounds
  WHERE logs.event_name = 'page_view'
    AND logs.occurred_at >= bounds.starts_at
    AND logs.occurred_at < bounds.ends_at
    AND COALESCE(logs.user_agent, '') !~* '(bot|crawler|spider|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|naverbot|yeti)'
), anonymous_users AS (
  SELECT anonymous_id, MIN(user_id::TEXT)::UUID AS user_id
  FROM today_logs
  WHERE anonymous_id IS NOT NULL AND user_id IS NOT NULL
  GROUP BY anonymous_id
), identified AS (
  SELECT
    (NOW() AT TIME ZONE 'Asia/Seoul')::DATE AS visit_date,
    logs.anonymous_id,
    COALESCE(logs.user_id, anonymous_users.user_id) AS resolved_user_id,
    logs.occurred_at,
    logs.path,
    logs.user_agent
  FROM today_logs logs
  LEFT JOIN anonymous_users USING (anonymous_id)
), keyed AS (
  SELECT *,
    CASE
      WHEN resolved_user_id IS NOT NULL THEN 'user:' || resolved_user_id::TEXT
      WHEN anonymous_id IS NOT NULL THEN 'anonymous:' || anonymous_id::TEXT
    END AS identity_key
  FROM identified
)
INSERT INTO daily_visitors(
  visit_date, identity_key, anonymous_id, user_id,
  first_seen_at, last_seen_at, last_path, user_agent
)
SELECT
  visit_date,
  identity_key,
  (ARRAY_AGG(anonymous_id) FILTER (WHERE anonymous_id IS NOT NULL))[1],
  (ARRAY_AGG(resolved_user_id) FILTER (WHERE resolved_user_id IS NOT NULL))[1],
  MIN(occurred_at),
  MAX(occurred_at),
  (ARRAY_AGG(path ORDER BY occurred_at DESC))[1],
  (ARRAY_AGG(user_agent ORDER BY occurred_at DESC))[1]
FROM keyed
WHERE identity_key IS NOT NULL
GROUP BY visit_date, identity_key
ON CONFLICT (visit_date, identity_key) DO UPDATE SET
  last_seen_at = GREATEST(daily_visitors.last_seen_at, EXCLUDED.last_seen_at),
  last_path = EXCLUDED.last_path,
  user_agent = EXCLUDED.user_agent;

COMMIT;
