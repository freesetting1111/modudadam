BEGIN;

-- 기존 클릭 단위 조회수는 고유 방문자를 복원할 수 없으므로,
-- 새 post_views 기록을 기준으로 정확한 값부터 다시 집계합니다.
UPDATE posts
SET view_count = COALESCE(counts.unique_views, 0)
FROM (
  SELECT posts.id,COUNT(post_views.viewer_key)::integer AS unique_views
  FROM posts
  LEFT JOIN post_views ON post_views.post_id=posts.id
  GROUP BY posts.id
) counts
WHERE posts.id=counts.id
  AND posts.view_count<>counts.unique_views;

COMMIT;
