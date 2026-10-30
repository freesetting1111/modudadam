BEGIN;

DO $$
BEGIN
  ALTER TABLE user_local_accounts
    ADD CONSTRAINT user_local_accounts_password_hash_format
    CHECK(password_hash LIKE 'scrypt$%');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
