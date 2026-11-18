BEGIN;

-- 공부엉이와 같은 기준으로 자동화 브라우저 방문 기록을 방문자 집계에서 제거합니다.
DELETE FROM daily_visitors
WHERE COALESCE(user_agent, '') ~* '(bot|crawler|spider|headless|lighthouse|phantomjs|selenium|puppeteer|playwright|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|naverbot|yeti)';

COMMIT;
