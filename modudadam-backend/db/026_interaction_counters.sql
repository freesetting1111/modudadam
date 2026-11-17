BEGIN;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS bookmark_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS like_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislike_count INTEGER NOT NULL DEFAULT 0;

UPDATE posts post
SET bookmark_count = counts.count
FROM (
  SELECT post.id, COUNT(bookmark.user_id)::INTEGER AS count
  FROM posts post
  LEFT JOIN post_bookmarks bookmark ON bookmark.post_id=post.id
  GROUP BY post.id
) counts
WHERE post.id=counts.id;

UPDATE comments comment
SET like_count=counts.like_count,
    dislike_count=counts.dislike_count
FROM (
  SELECT comment.id,
    COUNT(reaction.user_id) FILTER (WHERE reaction.reaction='like')::INTEGER AS like_count,
    COUNT(reaction.user_id) FILTER (WHERE reaction.reaction='dislike')::INTEGER AS dislike_count
  FROM comments comment
  LEFT JOIN comment_reactions reaction ON reaction.comment_id=comment.id
  GROUP BY comment.id
) counts
WHERE comment.id=counts.id;

ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_bookmark_count_nonnegative,
  ADD CONSTRAINT posts_bookmark_count_nonnegative CHECK (bookmark_count >= 0);

ALTER TABLE comments
  DROP CONSTRAINT IF EXISTS comments_reaction_counts_nonnegative,
  ADD CONSTRAINT comments_reaction_counts_nonnegative CHECK (like_count >= 0 AND dislike_count >= 0);

COMMIT;
