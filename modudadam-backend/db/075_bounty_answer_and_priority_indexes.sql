-- 현상금 질문의 금액순 목록과 공개 답변 조회를 위한 보조 인덱스입니다.
-- 여러 번 실행해도 안전합니다.

BEGIN;

CREATE INDEX IF NOT EXISTS post_acorn_bounties_open_priority_created_idx
  ON post_acorn_bounties(amount DESC,created_at DESC,post_id)
  WHERE status='open';

CREATE INDEX IF NOT EXISTS comments_public_root_answers_idx
  ON comments(post_id,created_at DESC,id)
  WHERE parent_id IS NULL AND status='published';

COMMIT;
