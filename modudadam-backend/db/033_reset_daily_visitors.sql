BEGIN;

-- IP 저장 기능 적용 전에 생성된 방문자 집계 데이터만 초기화합니다.
-- 회원, 게시글, access_logs 데이터에는 영향을 주지 않습니다.
DELETE FROM daily_visitors;

COMMIT;
