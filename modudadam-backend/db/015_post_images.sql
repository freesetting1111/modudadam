ALTER TABLE posts DROP COLUMN IF EXISTS summary;

CREATE TABLE IF NOT EXISTS post_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key varchar(1024) NOT NULL UNIQUE,
  original_name varchar(255) NOT NULL,
  mime_type varchar(100) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  byte_size bigint NOT NULL CHECK (byte_size > 0 AND byte_size <= 10485760),
  sort_order smallint NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order < 5),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'attached', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  attached_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS post_images_post_order_idx
  ON post_images(post_id, sort_order, created_at)
  WHERE status = 'attached';

CREATE INDEX IF NOT EXISTS post_images_pending_cleanup_idx
  ON post_images(created_at)
  WHERE post_id IS NULL AND status IN ('pending', 'ready');
