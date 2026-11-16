BEGIN;

CREATE TABLE IF NOT EXISTS profile_email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_address varchar(320) NOT NULL,
  code_hash char(64) NOT NULL,
  attempt_count smallint NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS profile_email_verifications_active_idx
  ON profile_email_verifications(user_id, created_at DESC)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE profile_email_verifications IS
  '마이페이지에서 직접 입력한 이메일의 소유 여부를 확인하는 일회용 인증번호';

CREATE TABLE IF NOT EXISTS app_data_migrations (
  migration_key varchar(120) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- 기존 소셜 제공값 정리는 최초 1회만 수행한다. 이 파일이 다시 실행되어도
-- 사용자가 이후 직접 선택·인증한 값은 유지된다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM app_data_migrations
    WHERE migration_key = '013_remove_legacy_social_profile_data'
  ) THEN
    UPDATE users
    SET email = CASE WHEN email_verified_at IS NULL THEN NULL ELSE email END,
        phone_number = NULL,
        phone_verified_at = NULL,
        gender = NULL,
        age_range = NULL,
        updated_at = now()
    WHERE EXISTS (SELECT 1 FROM user_oauth_accounts account WHERE account.user_id = users.id)
      AND NOT EXISTS (SELECT 1 FROM user_local_accounts local_account WHERE local_account.user_id = users.id);

    UPDATE user_oauth_accounts
    SET provider_email = NULL,
        provider_phone_number = NULL,
        provider_gender = NULL,
        provider_age_range = NULL,
        profile = jsonb_strip_nulls(jsonb_build_object(
          'id', provider_user_id,
          'nickname', provider_nickname
        ));

    INSERT INTO app_data_migrations(migration_key)
    VALUES ('013_remove_legacy_social_profile_data');
  END IF;
END $$;

COMMIT;
