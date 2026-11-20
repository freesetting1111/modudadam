BEGIN;

-- 사용자 선물은 10개 단위로 최대 20,000개까지 보낼 수 있습니다.
ALTER TABLE acorn_gifts DROP CONSTRAINT IF EXISTS acorn_gifts_amount_check;
ALTER TABLE acorn_gifts ADD CONSTRAINT acorn_gifts_amount_check
  CHECK (
    amount BETWEEN 1 AND 20000
    AND (gift_type <> 'user' OR (amount >= 10 AND amount % 10 = 0))
  );

ALTER TABLE acorn_gifts DROP CONSTRAINT IF EXISTS acorn_gifts_gift_type_check;
ALTER TABLE acorn_gifts ADD CONSTRAINT acorn_gifts_gift_type_check
  CHECK (gift_type IN ('user','signup_package','choice_reward'));

CREATE UNIQUE INDEX IF NOT EXISTS acorn_gifts_choice_reward_once_idx
  ON acorn_gifts(recipient_id,request_key)
  WHERE gift_type='choice_reward';

-- 날짜별 결과 확정 기록입니다. 한 번 확정된 문제는 다시 정산하지 않습니다.
CREATE TABLE IF NOT EXISTS daily_choice_reward_batches (
  choice_id uuid PRIMARY KEY REFERENCES daily_choices(id) ON DELETE CASCADE,
  choice_on date NOT NULL,
  winner_option_id uuid REFERENCES daily_choice_options(id) ON DELETE SET NULL,
  is_tie boolean NOT NULL DEFAULT false,
  participant_count integer NOT NULL DEFAULT 0 CHECK (participant_count >= 0),
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS daily_choice_reward_batches_date_idx
  ON daily_choice_reward_batches(choice_on DESC);

-- 기능 배포 이전 문제는 소급 지급하지 않고 정산 완료로 표시합니다.
INSERT INTO daily_choice_reward_batches(choice_id,choice_on,participant_count)
SELECT choices.id,choices.active_on,0 FROM daily_choices choices
WHERE choices.active_on < (now() AT TIME ZONE 'Asia/Seoul')::date
ON CONFLICT(choice_id) DO NOTHING;

-- 사용자별 보상과 선물보따리 항목을 연결해 지급 근거를 영구 보존합니다.
CREATE TABLE IF NOT EXISTS daily_choice_rewards (
  choice_id uuid NOT NULL REFERENCES daily_choices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES daily_choice_options(id) ON DELETE CASCADE,
  outcome varchar(10) NOT NULL CHECK (outcome IN ('winner','loser','tie')),
  reward_amount integer NOT NULL CHECK (reward_amount IN (10,20)),
  gift_id uuid NOT NULL UNIQUE REFERENCES acorn_gifts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(choice_id,user_id)
);
CREATE INDEX IF NOT EXISTS daily_choice_rewards_user_idx
  ON daily_choice_rewards(user_id,created_at DESC);

COMMIT;
