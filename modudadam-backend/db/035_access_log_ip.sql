BEGIN;

ALTER TABLE access_logs
  ADD COLUMN IF NOT EXISTS ip_address inet;

CREATE INDEX IF NOT EXISTS access_logs_ip_occurred_idx
  ON access_logs(ip_address, occurred_at DESC)
  WHERE ip_address IS NOT NULL;

COMMENT ON COLUMN access_logs.ip_address IS
  '페이지 접속 당시 원본 IP. 신규 로그부터 저장되며 기존 해시값에서는 복원할 수 없다.';

COMMIT;
