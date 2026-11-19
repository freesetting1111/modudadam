BEGIN;

CREATE TABLE IF NOT EXISTS time_capsules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(80) NOT NULL,
  content varchar(4000) NOT NULL,
  visibility varchar(12) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private','public')),
  status varchar(12) NOT NULL DEFAULT 'sealed' CHECK (status IN ('sealed','opened','deleted')),
  opens_at timestamptz NOT NULL,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (opens_at > created_at),
  CHECK ((status = 'opened' AND opened_at IS NOT NULL) OR status <> 'opened')
);
CREATE INDEX IF NOT EXISTS time_capsules_user_idx
  ON time_capsules(user_id, created_at DESC) WHERE status <> 'deleted';
CREATE INDEX IF NOT EXISTS time_capsules_public_idx
  ON time_capsules(opened_at DESC) WHERE status = 'opened' AND visibility = 'public';

CREATE TABLE IF NOT EXISTS detective_cases (
  id bigserial PRIMARY KEY,
  case_no integer NOT NULL UNIQUE CHECK (case_no BETWEEN 1 AND 500),
  title varchar(120) NOT NULL,
  briefing text NOT NULL,
  question varchar(240) NOT NULL,
  explanation text NOT NULL,
  difficulty smallint NOT NULL DEFAULT 5 CHECK (difficulty BETWEEN 1 AND 5),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE detective_cases ADD COLUMN IF NOT EXISTS source_dataset varchar(120);
ALTER TABLE detective_cases ADD COLUMN IF NOT EXISTS source_record_id varchar(120);
ALTER TABLE detective_cases ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE detective_cases ADD COLUMN IF NOT EXISTS source_license varchar(40);
ALTER TABLE detective_cases ADD COLUMN IF NOT EXISTS source_payload jsonb;

CREATE TABLE IF NOT EXISTS detective_case_suspects (
  id bigserial PRIMARY KEY,
  case_id bigint NOT NULL REFERENCES detective_cases(id) ON DELETE CASCADE,
  suspect_code varchar(20) NOT NULL,
  name varchar(40) NOT NULL,
  statement varchar(500) NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  sort_order smallint NOT NULL CHECK (sort_order BETWEEN 1 AND 10),
  UNIQUE(case_id, suspect_code),
  UNIQUE(case_id, sort_order)
);
CREATE UNIQUE INDEX IF NOT EXISTS detective_case_one_answer_idx
  ON detective_case_suspects(case_id) WHERE is_correct;

CREATE TABLE IF NOT EXISTS detective_case_hints (
  case_id bigint NOT NULL REFERENCES detective_cases(id) ON DELETE CASCADE,
  hint_order smallint NOT NULL CHECK (hint_order BETWEEN 1 AND 3),
  content varchar(500) NOT NULL,
  PRIMARY KEY(case_id, hint_order)
);

CREATE TABLE IF NOT EXISTS detective_daily_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id bigint NOT NULL REFERENCES detective_cases(id),
  play_on date NOT NULL,
  option_order bigint[] NOT NULL CHECK (cardinality(option_order) = 10),
  selected_suspect_ids bigint[] NOT NULL DEFAULT '{}'::bigint[],
  lives_remaining smallint NOT NULL DEFAULT 3 CHECK (lives_remaining BETWEEN 0 AND 3),
  hints_revealed smallint NOT NULL DEFAULT 0 CHECK (hints_revealed BETWEEN 0 AND 3),
  status varchar(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active','solved','failed')),
  reward_acorns smallint NOT NULL DEFAULT 0 CHECK (reward_acorns BETWEEN 0 AND 5),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, play_on)
);
CREATE INDEX IF NOT EXISTS detective_attempts_user_idx
  ON detective_daily_attempts(user_id, play_on DESC);

ALTER TABLE acorn_transactions
  DROP CONSTRAINT IF EXISTS acorn_transactions_transaction_type_check;
ALTER TABLE acorn_transactions
  ADD CONSTRAINT acorn_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'attendance','attendance_bonus','challenge_checkin','challenge_complete',
    'mission_complete','stamp_purchase','gift_sent','gift_received','detective_reward'
  ));

COMMIT;
