BEGIN;

CREATE TABLE IF NOT EXISTS user_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  reason_code VARCHAR(30) NOT NULL CHECK (reason_code IN (
    'content_lack', 'low_usage', 'privacy_concern', 'usability', 'other'
  )),
  reason_detail VARCHAR(500),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_withdrawals_other_detail_check CHECK (
    reason_code <> 'other' OR length(trim(COALESCE(reason_detail, ''))) BETWEEN 1 AND 500
  )
);

CREATE INDEX IF NOT EXISTS user_withdrawals_requested_idx
  ON user_withdrawals(requested_at DESC);

COMMENT ON TABLE user_withdrawals IS
  '개인정보를 익명화한 탈퇴 계정의 탈퇴 사유 및 처리 시각';

COMMIT;
