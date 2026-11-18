BEGIN;

CREATE TABLE IF NOT EXISTS choice_prompt_bank (
  id bigserial PRIMARY KEY,
  prompt_key varchar(40) NOT NULL UNIQUE,
  category varchar(30) NOT NULL,
  question varchar(240) NOT NULL,
  description varchar(500),
  option_a_label varchar(120) NOT NULL,
  option_a_emoji varchar(16),
  option_b_label varchar(120) NOT NULL,
  option_b_emoji varchar(16),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE daily_choices ADD COLUMN IF NOT EXISTS source_prompt_id bigint REFERENCES choice_prompt_bank(id);
CREATE INDEX IF NOT EXISTS choice_prompt_bank_enabled_idx ON choice_prompt_bank(id) WHERE enabled;

WITH left_options(label,emoji,category,n) AS (
  SELECT * FROM unnest(
    ARRAY['집에서 늦잠 자기','새벽 산책하기','조용한 서점 가기','직접 요리하기','사진으로 기록하기','계획표대로 움직이기','혼자 영화 보기','오래된 맛집 가기','바다 보러 가기','반려동물과 놀기','종이책 읽기','따뜻한 차 마시기','한 가지 취미 파기','동네 골목 걷기','일찍 하루 시작하기','필요한 것만 사기','친한 친구와 대화하기','익숙한 음악 듣기','천천히 오래 여행하기','작은 선물 준비하기'],
    ARRAY['🛌','🌅','📚','🍳','📷','🗓️','🎬','🍲','🌊','🐾','📖','🫖','🎨','🚶','☀️','🧺','☕','🎧','🚆','🎁'],
    ARRAY['휴식','일상','문화','음식','기록','생활','문화','음식','여행','반려','취미','휴식','취미','동네','생활','소비','관계','음악','여행','관계'],
    ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]
  )
), right_options(label,emoji,n) AS (
  SELECT * FROM unnest(
    ARRAY['새로운 동네 탐험하기','밤늦게까지 놀기','사람 많은 축제 가기','맛있는 음식 배달하기','기억은 마음에 담기','그날 기분대로 움직이기','친구들과 함께 보기','새로 생긴 식당 가기','숲속에서 쉬기','새로운 취미 배우기','오디오북 듣기','시원한 탄산 마시기','여러 취미 맛보기','도심 명소 구경하기','늦은 밤 집중하기','마음에 들면 바로 사기'],
    ARRAY['🧭','🌙','🎉','🛵','💭','🎈','🍿','✨','🌲','🧩','🎧','🥤','🌈','🏙️','🌜','🛍️'],
    ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]
  )
)
INSERT INTO choice_prompt_bank(prompt_key,category,question,description,option_a_label,option_a_emoji,option_b_label,option_b_emoji)
SELECT format('daily-%s-%s',l.n,r.n),l.category,
       format('%s VS %s, 오늘 더 끌리는 쪽은?',l.label,r.label),
       '정답은 없어요. 지금 내 마음에 더 가까운 선택을 골라보세요.',
       l.label,l.emoji,r.label,r.emoji
FROM left_options l CROSS JOIN right_options r
ON CONFLICT(prompt_key) DO UPDATE SET
  category=EXCLUDED.category,question=EXCLUDED.question,description=EXCLUDED.description,
  option_a_label=EXCLUDED.option_a_label,option_a_emoji=EXCLUDED.option_a_emoji,
  option_b_label=EXCLUDED.option_b_label,option_b_emoji=EXCLUDED.option_b_emoji,enabled=true;

ALTER TABLE mailbox_comments ADD COLUMN IF NOT EXISTS reply_type varchar(30);
ALTER TABLE mailbox_comments DROP CONSTRAINT IF EXISTS mailbox_comments_reply_type_check;
ALTER TABLE mailbox_comments ADD CONSTRAINT mailbox_comments_reply_type_check
  CHECK (reply_type IS NULL OR reply_type IN ('cheer','understand','helpful','empathy','thanks','together'));
CREATE INDEX IF NOT EXISTS mailbox_comments_reply_idx
  ON mailbox_comments(post_id,reply_type) WHERE status='published';

COMMIT;

-- 확인용: SELECT COUNT(*) FROM choice_prompt_bank WHERE enabled;  -- 320
