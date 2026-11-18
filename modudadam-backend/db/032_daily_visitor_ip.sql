BEGIN;

ALTER TABLE daily_visitors
  ADD COLUMN IF NOT EXISTS ip_address INET;

COMMENT ON COLUMN daily_visitors.ip_address IS
  '리버스 프록시 전달 헤더에서 확인한 해당 방문자의 최근 접속 IP';

COMMIT;
