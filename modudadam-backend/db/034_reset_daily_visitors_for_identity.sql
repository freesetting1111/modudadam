BEGIN;

-- 익명 UUID별로 중복 생성된 기존 당일 방문자 집계를 초기화합니다.
-- 이후 비회원은 IP + User-Agent 기반 당일 고정 식별키로 다시 집계됩니다.
DELETE FROM daily_visitors;

COMMIT;
