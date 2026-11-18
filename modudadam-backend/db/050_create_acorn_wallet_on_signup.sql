BEGIN;

-- 기존 회원 중 아직 도토리 지갑이 없는 계정을 모두 보정합니다.
INSERT INTO acorn_wallets(user_id)
SELECT users.id
FROM users
LEFT JOIN acorn_wallets wallets ON wallets.user_id=users.id
WHERE wallets.user_id IS NULL
ON CONFLICT(user_id) DO NOTHING;

-- 가입 경로가 추가되더라도 users 생성과 동시에 지갑이 항상 만들어지게 합니다.
CREATE OR REPLACE FUNCTION create_acorn_wallet_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO acorn_wallets(user_id)
  VALUES(NEW.id)
  ON CONFLICT(user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_create_acorn_wallet_trigger ON users;
CREATE TRIGGER users_create_acorn_wallet_trigger
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_acorn_wallet_for_new_user();

COMMIT;
