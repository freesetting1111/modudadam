BEGIN;

ALTER TABLE user_local_accounts
  DROP CONSTRAINT IF EXISTS user_local_accounts_login_id_format;

ALTER TABLE user_local_accounts
  ADD CONSTRAINT user_local_accounts_login_id_format
  CHECK(login_id ~ '^[!-~]{4,12}$');

COMMIT;
