BEGIN;

UPDATE user_local_accounts
SET login_id = lower(login_id),
    updated_at = now()
WHERE login_id <> lower(login_id);

ALTER TABLE user_local_accounts
  DROP CONSTRAINT IF EXISTS user_local_accounts_login_id_format;

ALTER TABLE user_local_accounts
  ADD CONSTRAINT user_local_accounts_login_id_format
  CHECK(
    login_id ~ '^[!-~]{4,12}$'
    AND login_id = lower(login_id)
  );

COMMIT;
