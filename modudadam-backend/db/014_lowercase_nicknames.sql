BEGIN;

UPDATE users
SET nickname = lower(nickname), updated_at = now()
WHERE nickname ~ '[A-Z]';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_nickname_no_uppercase'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_nickname_no_uppercase
      CHECK (nickname !~ '[A-Z]') NOT VALID;
  END IF;
END $$;

COMMIT;
