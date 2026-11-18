BEGIN;

CREATE TABLE IF NOT EXISTS daily_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question varchar(240) NOT NULL,
  description varchar(500),
  active_on date NOT NULL UNIQUE,
  status varchar(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_choice_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  choice_id uuid NOT NULL REFERENCES daily_choices(id) ON DELETE CASCADE,
  label varchar(120) NOT NULL,
  emoji varchar(16),
  sort_order smallint NOT NULL,
  UNIQUE(choice_id, sort_order)
);

CREATE TABLE IF NOT EXISTS daily_choice_votes (
  choice_id uuid NOT NULL REFERENCES daily_choices(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES daily_choice_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(choice_id, user_id)
);
CREATE INDEX IF NOT EXISTS daily_choice_votes_option_idx ON daily_choice_votes(option_id);

CREATE TABLE IF NOT EXISTS mailbox_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_alias varchar(12) NOT NULL,
  title varchar(80) NOT NULL,
  content varchar(4000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, author_alias)
);

CREATE TABLE IF NOT EXISTS mailbox_participants (
  post_id uuid NOT NULL REFERENCES mailbox_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anonymous_alias varchar(12) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id, user_id),
  UNIQUE(post_id, anonymous_alias)
);

CREATE TABLE IF NOT EXISTS mailbox_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES mailbox_posts(id) ON DELETE CASCADE,
  participant_user_id uuid NOT NULL,
  content varchar(2000) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(post_id, participant_user_id) REFERENCES mailbox_participants(post_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mailbox_posts_feed_idx ON mailbox_posts(created_at DESC) WHERE status='published';
CREATE INDEX IF NOT EXISTS mailbox_comments_post_idx ON mailbox_comments(post_id, created_at) WHERE status='published';

CREATE TABLE IF NOT EXISTS taste_quiz_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_code varchar(50) NOT NULL,
  result_code varchar(50) NOT NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS taste_quiz_results_user_idx ON taste_quiz_results(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS local_treasures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(100) NOT NULL,
  treasure_type varchar(30) NOT NULL CHECK (treasure_type IN ('walk','food','pet','rest','photo','helpful')),
  description varchar(1000) NOT NULL,
  address varchar(300) NOT NULL,
  latitude numeric(9,6),
  longitude numeric(9,6),
  status varchar(20) NOT NULL DEFAULT 'published' CHECK (status IN ('published','hidden','deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR
    (latitude IS NOT NULL AND longitude IS NOT NULL AND latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE INDEX IF NOT EXISTS local_treasures_feed_idx ON local_treasures(created_at DESC) WHERE status='published';
CREATE INDEX IF NOT EXISTS local_treasures_geo_idx ON local_treasures(latitude, longitude) WHERE status='published' AND latitude IS NOT NULL;

WITH seeded(active_on, question, description, options) AS (
  VALUES
    (DATE '2026-11-18', '하루 동안 한 가지 능력을 가질 수 있다면?', '오늘의 선택에 참여하고 다른 사람들의 선택도 확인해 보세요.', '[{"label":"동물과 대화하기","emoji":"🐾"},{"label":"어디든 순간이동하기","emoji":"✨"}]'::jsonb),
    (DATE '2026-11-19', '쉬는 날, 더 끌리는 쪽은?', '정답은 없어요. 지금 마음이 가는 쪽을 골라보세요.', '[{"label":"집에서 온전히 쉬기","emoji":"🏠"},{"label":"밖으로 나가 새로운 곳 보기","emoji":"🌿"}]'::jsonb),
    (DATE '2026-11-20', '평생 하나만 고른다면?', '모두다담 회원들의 취향은 어느 쪽일까요?', '[{"label":"좋아하는 음식 마음껏 먹기","emoji":"🍲"},{"label":"좋아하는 여행 마음껏 가기","emoji":"🧳"}]'::jsonb)
), inserted AS (
  INSERT INTO daily_choices(active_on,question,description)
  SELECT active_on,question,description FROM seeded
  ON CONFLICT(active_on) DO UPDATE SET question=EXCLUDED.question,description=EXCLUDED.description,updated_at=now()
  RETURNING id,active_on
)
INSERT INTO daily_choice_options(choice_id,label,emoji,sort_order)
SELECT inserted.id, option->>'label', option->>'emoji', option_index::smallint
FROM inserted JOIN seeded USING(active_on)
CROSS JOIN LATERAL jsonb_array_elements(seeded.options) WITH ORDINALITY AS item(option,option_index)
ON CONFLICT(choice_id,sort_order) DO UPDATE SET label=EXCLUDED.label,emoji=EXCLUDED.emoji;

COMMIT;
