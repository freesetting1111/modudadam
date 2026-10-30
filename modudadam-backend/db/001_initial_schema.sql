BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN CREATE TYPE oauth_provider AS ENUM ('kakao', 'naver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE user_status AS ENUM ('active', 'suspended', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE post_status AS ENUM ('draft', 'published', 'hidden', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname varchar(60) NOT NULL,
  email varchar(320),
  avatar_url text,
  status user_status NOT NULL DEFAULT 'active',
  role varchar(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_active ON users(lower(email))
  WHERE email IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider oauth_provider NOT NULL,
  provider_user_id varchar(255) NOT NULL,
  provider_email varchar(320),
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS oauth_accounts_user_idx ON user_oauth_accounts(user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  ip_hash char(64),
  user_agent text,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_sessions_active_idx ON user_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS categories (
  id smallserial PRIMARY KEY,
  code varchar(40) NOT NULL UNIQUE,
  name varchar(80) NOT NULL,
  icon varchar(16) NOT NULL,
  description varchar(240) NOT NULL,
  sort_order smallint NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO categories(code, name, icon, description, sort_order) VALUES
('pets','동물·반려동물','🐿️','반려동물 기록, 양육 정보, 용품과 장소',1),
('food','음식·요리','🍲','레시피, 식단, 식재료와 장보기',2),
('home','집·주거·살림','🏠','집 꾸미기, 청소, 수납, 수리와 가전',3),
('hobby','취미·수집','🎨','작품, 장비, 수집품과 취미 정보',4),
('travel','여행·나들이','🧳','여행지, 일정, 여행 기록과 동행',5),
('wellness','운동·생활습관','🏃','운동 기록, 목표, 루틴과 챌린지',6),
('family','육아·가족','👨‍👩‍👧','성장 기록, 놀이, 가족 일정과 육아 정보',7),
('mobility','자동차·이동생활','🚙','차량 관리, 정비 이력, 유지비와 드라이브',8),
('style','패션·뷰티','👗','옷장, 코디, 제품 기록과 취향',9),
('learning','학습·자기계발','📚','학습 기록, 목표, 자료와 스터디',10),
('local','지역·동네생활','📍','동네 장소, 행사, 모임과 생활 정보',11),
('culture','문화·콘텐츠','🎬','영화, 책, 게임, 공연과 감상 기록',12)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name, icon=EXCLUDED.icon,
description=EXCLUDED.description, sort_order=EXCLUDED.sort_order, updated_at=now();

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id smallint NOT NULL REFERENCES categories(id),
  author_id uuid NOT NULL REFERENCES users(id),
  title varchar(200) NOT NULL,
  summary varchar(500),
  content text NOT NULL,
  post_type varchar(40) NOT NULL DEFAULT 'community',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status post_status NOT NULL DEFAULT 'published',
  view_count integer NOT NULL DEFAULT 0 CHECK(view_count >= 0),
  comment_count integer NOT NULL DEFAULT 0 CHECK(comment_count >= 0),
  reaction_count integer NOT NULL DEFAULT 0 CHECK(reaction_count >= 0),
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS posts_category_feed_idx ON posts(category_id, published_at DESC, id)
  WHERE status='published';
CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS posts_attributes_gin_idx ON posts USING gin(attributes);

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id),
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  content varchar(3000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'published' CHECK(status IN ('published','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS post_reactions (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction varchar(20) NOT NULL DEFAULT 'like',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id, user_id, reaction)
);
CREATE TABLE IF NOT EXISTS post_bookmarks (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id, user_id)
);
CREATE TABLE IF NOT EXISTS tags (
  id bigserial PRIMARY KEY,
  name varchar(60) NOT NULL,
  normalized_name varchar(60) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS post_tags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id bigint NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS user_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id smallint NOT NULL REFERENCES categories(id),
  record_type varchar(60) NOT NULL,
  title varchar(200) NOT NULL,
  record_date date NOT NULL DEFAULT current_date,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility varchar(20) NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','followers','public')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_records_owner_idx ON user_records(user_id, record_date DESC);
CREATE INDEX IF NOT EXISTS user_records_data_gin_idx ON user_records USING gin(data);

CREATE TABLE IF NOT EXISTS access_logs (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  event_name varchar(80) NOT NULL DEFAULT 'page_view',
  anonymous_id uuid,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id varchar(100),
  path text NOT NULL,
  query_string text,
  page_title varchar(300),
  referrer text,
  landing_url text,
  utm_source varchar(100), utm_medium varchar(100), utm_campaign varchar(200),
  utm_content varchar(200), utm_term varchar(200),
  gclid varchar(255), fbclid varchar(255),
  device_type varchar(20), viewport_width integer, viewport_height integer,
  locale varchar(30), timezone varchar(80), user_agent text, ip_hash char(64),
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS access_logs_occurred_idx ON access_logs(occurred_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_anonymous_idx ON access_logs(anonymous_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_user_idx ON access_logs(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_path_idx ON access_logs(path, occurred_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_source_idx ON access_logs(utm_source, utm_medium, occurred_at DESC);
CREATE INDEX IF NOT EXISTS access_logs_properties_gin_idx ON access_logs USING gin(properties);

CREATE TABLE IF NOT EXISTS user_attributions (
  identity_key varchar(100) PRIMARY KEY,
  anonymous_id uuid,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  first_source varchar(100), first_medium varchar(100), first_campaign varchar(200),
  first_referrer text, first_landing_url text, first_seen_at timestamptz,
  last_source varchar(100), last_medium varchar(100), last_campaign varchar(200),
  last_referrer text, last_landing_url text, last_seen_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_attributions_user_idx ON user_attributions(user_id);
CREATE INDEX IF NOT EXISTS user_attributions_anonymous_idx ON user_attributions(anonymous_id);
COMMIT;
