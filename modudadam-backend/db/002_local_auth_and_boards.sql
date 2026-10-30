BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS real_name varchar(80),
  ADD COLUMN IF NOT EXISTS phone_number varchar(20),
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_agreed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_active
  ON users(phone_number)
  WHERE phone_number IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_local_accounts (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  login_id varchar(30) NOT NULL,
  password_hash text NOT NULL,
  failed_login_count smallint NOT NULL DEFAULT 0 CHECK(failed_login_count >= 0),
  locked_until timestamptz,
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_local_accounts_login_id_unique
  ON user_local_accounts(lower(login_id));

CREATE TABLE IF NOT EXISTS boards (
  id smallserial PRIMARY KEY,
  category_id smallint NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description varchar(300),
  read_permission varchar(20) NOT NULL DEFAULT 'public' CHECK(read_permission IN ('public','member')),
  write_permission varchar(20) NOT NULL DEFAULT 'member' CHECK(write_permission IN ('member','moderator','admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO boards(category_id, name, description)
SELECT id, name || ' 게시판', description
FROM categories
ON CONFLICT(category_id) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  updated_at=now();

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_notice boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS posts_board_order_idx
  ON posts(category_id, is_pinned DESC, published_at DESC, created_at DESC)
  WHERE status='published';

COMMIT;
