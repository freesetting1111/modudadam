BEGIN;

DO $$
BEGIN
  ALTER TABLE user_local_accounts
    ADD CONSTRAINT user_local_accounts_login_id_format
    CHECK(login_id ~ '^[A-Za-z0-9_]{4,12}$') NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
