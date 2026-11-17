BEGIN;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES comments(id) ON DELETE SET NULL;

UPDATE comments
SET reply_to_id = parent_id
WHERE parent_id IS NOT NULL AND reply_to_id IS NULL;

CREATE INDEX IF NOT EXISTS comments_reply_to_idx
  ON comments(reply_to_id, created_at, id)
  WHERE status IN ('published', 'deleted');

CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction VARCHAR(20) NOT NULL CHECK (reaction IN ('like', 'dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS comment_reactions_comment_type_idx
  ON comment_reactions(comment_id, reaction);

CREATE INDEX IF NOT EXISTS post_reactions_post_type_idx
  ON post_reactions(post_id, reaction);

CREATE OR REPLACE FUNCTION enforce_comment_reply_target_same_post()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_post_id UUID;
BEGIN
  IF NEW.reply_to_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.reply_to_id = NEW.id THEN
    RAISE EXCEPTION 'A comment cannot reply to itself.';
  END IF;

  SELECT post_id INTO target_post_id FROM comments WHERE id = NEW.reply_to_id;
  IF target_post_id IS NULL OR target_post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'A reply target must belong to the same post.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_reply_target_same_post_trigger ON comments;
CREATE TRIGGER comments_reply_target_same_post_trigger
  BEFORE INSERT OR UPDATE OF reply_to_id, post_id ON comments
  FOR EACH ROW EXECUTE FUNCTION enforce_comment_reply_target_same_post();

UPDATE posts post
SET reaction_count = counts.like_count
FROM (
  SELECT post.id, COUNT(reaction.user_id)::INTEGER AS like_count
  FROM posts post
  LEFT JOIN post_reactions reaction
    ON reaction.post_id = post.id AND reaction.reaction = 'like'
  GROUP BY post.id
) counts
WHERE post.id = counts.id;

COMMIT;
