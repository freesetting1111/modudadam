BEGIN;

-- 한 회원 또는 한 비회원 브라우저가 같은 글을 여러 번 열어도 조회수는 한 번만 반영합니다.
CREATE TABLE IF NOT EXISTS post_views (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_key varchar(80) NOT NULL,
  first_viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, viewer_key)
);

CREATE INDEX IF NOT EXISTS post_views_first_viewed_idx
  ON post_views(first_viewed_at DESC);

COMMIT;
