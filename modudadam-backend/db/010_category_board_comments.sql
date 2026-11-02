BEGIN;

CREATE INDEX IF NOT EXISTS comments_post_parent_order_idx
  ON comments(post_id, parent_id, created_at, id)
  WHERE status IN ('published', 'deleted');

CREATE OR REPLACE FUNCTION enforce_comment_parent_same_post()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_post_id uuid;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A comment cannot be its own parent.';
  END IF;

  SELECT post_id INTO parent_post_id
  FROM comments
  WHERE id = NEW.parent_id;

  IF parent_post_id IS NULL OR parent_post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'A reply parent must belong to the same post.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_parent_same_post_trigger ON comments;
CREATE TRIGGER comments_parent_same_post_trigger
  BEFORE INSERT OR UPDATE OF parent_id, post_id ON comments
  FOR EACH ROW
  EXECUTE FUNCTION enforce_comment_parent_same_post();

UPDATE posts
SET comment_count = counts.published_count
FROM (
  SELECT posts.id,
    count(comments.id) FILTER (WHERE comments.status = 'published')::integer AS published_count
  FROM posts
  LEFT JOIN comments ON comments.post_id = posts.id
  GROUP BY posts.id
) AS counts
WHERE posts.id = counts.id
  AND posts.comment_count <> counts.published_count;

COMMIT;
