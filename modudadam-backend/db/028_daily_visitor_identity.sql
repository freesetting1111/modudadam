BEGIN;

CREATE INDEX IF NOT EXISTS daily_visitors_anonymous_day_idx
  ON daily_visitors(visit_date, anonymous_id)
  WHERE anonymous_id IS NOT NULL;

COMMIT;
