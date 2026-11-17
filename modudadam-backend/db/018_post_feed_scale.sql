BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 공개 글은 커서 페이지네이션에서 NULL 정렬 예외가 생기지 않도록 발행 시각을 보정합니다.
UPDATE posts
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

-- 게시판별/전체 최신 글 커서 조회용 인덱스입니다.
CREATE INDEX IF NOT EXISTS posts_published_feed_v2_idx
  ON posts(is_pinned DESC, published_at DESC, id DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS posts_category_published_feed_v2_idx
  ON posts(category_id, is_pinned DESC, published_at DESC, id DESC)
  WHERE status = 'published';

-- 위 인덱스로 대체되는 예전 피드 인덱스는 쓰기 비용만 늘리므로 제거합니다.
DROP INDEX IF EXISTS posts_category_feed_idx;
DROP INDEX IF EXISTS posts_board_order_idx;

-- 인기순은 OFFSET 없이 점수와 발행 시각을 커서로 사용합니다.
CREATE INDEX IF NOT EXISTS posts_category_popular_feed_idx
  ON posts(category_id, is_pinned DESC, ((view_count + comment_count * 3)) DESC, published_at DESC, id DESC)
  WHERE status = 'published';

-- 한글을 포함한 부분 문자열 검색이 전체 테이블 순차 탐색으로 떨어지지 않게 합니다.
CREATE INDEX IF NOT EXISTS posts_title_content_trgm_idx
  ON posts USING gin (((title || ' ' || content)) gin_trgm_ops)
  WHERE status = 'published';

-- 업로드 완료 전 이미지 정리와 사용자별 미연결 이미지 확인용입니다.
CREATE INDEX IF NOT EXISTS post_images_owner_unattached_idx
  ON post_images(owner_id, status, created_at DESC)
  WHERE post_id IS NULL;

COMMIT;
