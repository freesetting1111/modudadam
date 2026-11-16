CREATE TABLE IF NOT EXISTS content_reports (
  id bigserial PRIMARY KEY,
  reporter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type varchar(20) NOT NULL CHECK (target_type IN ('post', 'comment')),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  reason_code varchar(50) NOT NULL,
  reason_detail varchar(1000),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_target_check CHECK (
    (target_type='post' AND post_id IS NOT NULL AND comment_id IS NULL)
    OR (target_type='comment' AND comment_id IS NOT NULL AND post_id IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS content_reports_user_post_unique
  ON content_reports(reporter_id, post_id) WHERE target_type='post';
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_user_comment_unique
  ON content_reports(reporter_id, comment_id) WHERE target_type='comment';
CREATE INDEX IF NOT EXISTS content_reports_review_idx
  ON content_reports(status, created_at DESC);
