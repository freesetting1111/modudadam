BEGIN;

-- 도토리는 무료 활동에서 무제한 발행하지 않고, 도움을 주고받을 때 이동하는 재화로 운영합니다.
CREATE TABLE IF NOT EXISTS acorn_economy_settings (
  setting_key varchar(60) PRIMARY KEY,
  setting_value integer NOT NULL CHECK (setting_value >= 0),
  description varchar(200) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO acorn_economy_settings(setting_key,setting_value,description) VALUES
  ('daily_free_emission_limit',5,'출석·미션·챌린지·추리방에서 한 사용자가 하루에 받을 수 있는 무료 도토리 합계'),
  ('signup_package_amount',20,'신규가입 패키지 도토리'),
  ('bounty_fee_percent',10,'답변 현상금 채택 시 소각 비율'),
  ('bounty_minimum',100,'게시글 답변 현상금 최소 금액'),
  ('bounty_maximum',300,'현상금 질문의 최대 금액')
ON CONFLICT(setting_key) DO UPDATE SET
  setting_value=EXCLUDED.setting_value,
  description=EXCLUDED.description,
  updated_at=now();

-- 무료 발행 보상은 장기 활동을 해치지 않는 수준으로 축소합니다.
UPDATE dadam_challenges
SET daily_acorns=0,
    completion_acorns=CASE
      WHEN goal_days>=14 THEN 5
      WHEN goal_days>=7 THEN 3
      ELSE 2
    END;

-- 아직 수령하지 않은 신규가입 패키지만 새 정책에 맞춥니다. 이미 받은 잔액은 회수하지 않습니다.
UPDATE acorn_gifts
SET amount=20,
    message=format('modudadam님이 %s님에게 신규가입 패키지 도토리 20개를 보냈어요!',users.nickname)
FROM users
WHERE acorn_gifts.recipient_id=users.id
  AND acorn_gifts.gift_type='signup_package'
  AND acorn_gifts.status IN ('sending','sent','viewed');

-- 극한 밸런스는 승리 3개, 그 외 1개로 축소합니다. 기존 확정 보상은 그대로 보존합니다.
ALTER TABLE daily_choice_rewards DROP CONSTRAINT IF EXISTS daily_choice_rewards_reward_amount_check;
ALTER TABLE daily_choice_rewards ADD CONSTRAINT daily_choice_rewards_reward_amount_check
  CHECK (reward_amount IN (1,3,10,20));

ALTER TABLE acorn_transactions DROP CONSTRAINT IF EXISTS acorn_transactions_transaction_type_check;
ALTER TABLE acorn_transactions ADD CONSTRAINT acorn_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'attendance','attendance_bonus','challenge_checkin','challenge_complete',
    'mission_complete','stamp_purchase','gift_sent','gift_received',
    'detective_reward','misdeed_conversion',
    'bounty_escrow','bounty_award','bounty_refund'
  ));

-- 보상 중복 검사는 지갑 행 잠금 안에서 수행하며, 과거 원장은 삭제하거나 합치지 않습니다.
CREATE INDEX IF NOT EXISTS acorn_transactions_reward_lookup_idx
  ON acorn_transactions(user_id,transaction_type,reference_id)
  WHERE reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS post_acorn_bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL UNIQUE REFERENCES posts(id) ON DELETE RESTRICT,
  sponsor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount IN (100,200,300)),
  fee_amount integer NOT NULL CHECK (fee_amount >= 0),
  award_amount integer NOT NULL CHECK (award_amount > 0),
  status varchar(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','awarded','refunded')),
  accepted_comment_id uuid REFERENCES comments(id) ON DELETE RESTRICT,
  recipient_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  expires_at timestamptz NOT NULL DEFAULT (now()+interval '7 days'),
  awarded_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (fee_amount+award_amount=amount),
  CHECK (
    (status='open' AND accepted_comment_id IS NULL AND recipient_id IS NULL AND awarded_at IS NULL AND refunded_at IS NULL)
    OR (status='awarded' AND accepted_comment_id IS NOT NULL AND recipient_id IS NOT NULL AND awarded_at IS NOT NULL AND refunded_at IS NULL)
    OR (status='refunded' AND accepted_comment_id IS NULL AND recipient_id IS NULL AND awarded_at IS NULL AND refunded_at IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS post_acorn_bounties_open_idx
  ON post_acorn_bounties(expires_at,post_id) WHERE status='open';
CREATE INDEX IF NOT EXISTS post_acorn_bounties_recipient_idx
  ON post_acorn_bounties(recipient_id,awarded_at DESC) WHERE status='awarded';

CREATE TABLE IF NOT EXISTS acorn_bounty_burns (
  bounty_id uuid PRIMARY KEY REFERENCES post_acorn_bounties(id) ON DELETE RESTRICT,
  amount integer NOT NULL CHECK (amount > 0),
  reason varchar(40) NOT NULL CHECK (reason IN ('answer_awarded','expired_with_answers')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 신뢰도는 소비 가능한 도토리와 분리합니다. 돈으로 신뢰도를 살 수 없게 하기 위함입니다.
CREATE TABLE IF NOT EXISTS user_help_reputation (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score >= 0),
  accepted_answers integer NOT NULL DEFAULT 0 CHECK (accepted_answers >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_help_reputation_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0),
  source_type varchar(40) NOT NULL CHECK (source_type IN ('bounty_answer')),
  source_key varchar(120) NOT NULL,
  description varchar(160) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,source_type,source_key)
);

COMMIT;
