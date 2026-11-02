BEGIN;

-- 로그인 비밀번호는 개인정보 테이블(users)이 아니라 인증 전용 테이블에만 보관합니다.
COMMENT ON TABLE user_local_accounts IS
  '로컬 로그인 자격증명. 평문 비밀번호는 저장하지 않고 단방향 scrypt 해시만 저장한다.';
COMMENT ON COLUMN user_local_accounts.password_hash IS
  'scrypt$<32자리 salt hex>$<128자리 derived key hex> 형식의 단방향 비밀번호 해시';

ALTER TABLE user_local_accounts
  ALTER COLUMN password_hash SET NOT NULL;

ALTER TABLE user_local_accounts
  DROP CONSTRAINT IF EXISTS user_local_accounts_password_hash_format;

ALTER TABLE user_local_accounts
  ADD CONSTRAINT user_local_accounts_password_hash_format
  CHECK(password_hash ~ E'^scrypt\\$[0-9a-f]{32}\\$[0-9a-f]{128}$');

CREATE UNIQUE INDEX IF NOT EXISTS user_local_accounts_login_id_unique
  ON user_local_accounts(lower(login_id));

COMMIT;
