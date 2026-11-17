BEGIN;

-- 최근 7일 댓글/추천 집계를 전체 테이블 스캔 없이 처리합니다.
CREATE INDEX IF NOT EXISTS comments_weekly_published_idx
  ON comments(created_at DESC, post_id)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS post_reactions_weekly_like_idx
  ON post_reactions(created_at DESC, post_id)
  WHERE reaction = 'like';

COMMIT;
