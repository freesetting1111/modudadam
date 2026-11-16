BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS status_message varchar(30),
  ADD COLUMN IF NOT EXISTS gender varchar(20),
  ADD COLUMN IF NOT EXISTS age_range varchar(20),
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

ALTER TABLE user_oauth_accounts
  ADD COLUMN IF NOT EXISTS provider_nickname varchar(120),
  ADD COLUMN IF NOT EXISTS provider_phone_number varchar(30),
  ADD COLUMN IF NOT EXISTS provider_gender varchar(20),
  ADD COLUMN IF NOT EXISTS provider_age_range varchar(20);

-- 기존 중복 닉네임은 서비스 닉네임 고유 제약을 걸기 전에 안전하게 구분합니다.
WITH duplicate_nicknames AS (
  SELECT id,
    row_number() OVER (PARTITION BY lower(nickname) ORDER BY created_at, id) AS duplicate_order
  FROM users
  WHERE deleted_at IS NULL
)
UPDATE users
SET nickname = left(users.nickname, 50) || '_' || left(users.id::text, 8),
    updated_at = now()
FROM duplicate_nicknames
WHERE users.id = duplicate_nicknames.id
  AND duplicate_nicknames.duplicate_order > 1;

CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_unique_active
  ON users(lower(nickname))
  WHERE deleted_at IS NULL;

-- 기존 OAuth 원본 JSON에서 검수 대상 프로필 정보를 가능한 범위까지 이관합니다.
UPDATE user_oauth_accounts
SET provider_nickname = COALESCE(
      provider_nickname,
      profile->>'nickname',
      profile->>'name',
      profile#>>'{kakao_account,profile,nickname}'
    ),
    provider_phone_number = COALESCE(
      provider_phone_number,
      profile->>'mobile',
      profile#>>'{kakao_account,phone_number}'
    ),
    provider_gender = COALESCE(
      provider_gender,
      profile->>'gender',
      profile#>>'{kakao_account,gender}'
    ),
    provider_age_range = COALESCE(
      provider_age_range,
      profile->>'age',
      profile->>'age_range',
      profile#>>'{kakao_account,age_range}'
    );

WITH latest_oauth_profile AS (
  SELECT DISTINCT ON (user_id)
    user_id, provider_gender, provider_age_range
  FROM user_oauth_accounts
  ORDER BY user_id, last_login_at DESC
)
UPDATE users
SET gender = COALESCE(users.gender, source.provider_gender),
    age_range = COALESCE(users.age_range, source.provider_age_range),
    updated_at = now()
FROM latest_oauth_profile source
WHERE source.user_id = users.id
  AND (users.gender IS NULL OR users.age_range IS NULL);

WITH oauth_phone AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    CASE
      WHEN regexp_replace(provider_phone_number, '[^0-9]', '', 'g') LIKE '82%'
        THEN '0' || substring(regexp_replace(provider_phone_number, '[^0-9]', '', 'g') FROM 3)
      ELSE regexp_replace(provider_phone_number, '[^0-9]', '', 'g')
    END AS phone_number
  FROM user_oauth_accounts
  WHERE provider_phone_number IS NOT NULL
  ORDER BY user_id, last_login_at DESC
)
UPDATE users
SET phone_number = source.phone_number,
    updated_at = now()
FROM oauth_phone source
WHERE source.user_id = users.id
  AND users.phone_number IS NULL
  AND source.phone_number ~ '^01(0|1|6|7|8|9)[0-9]{7,8}$'
  AND NOT EXISTS (
    SELECT 1 FROM users existing
    WHERE existing.phone_number = source.phone_number
      AND existing.id <> users.id
      AND existing.deleted_at IS NULL
  );

COMMENT ON COLUMN users.nickname IS
  '모두다담에서 표시하는 고유 닉네임. 소셜 원본 닉네임과 분리하여 사용자가 변경할 수 있다.';
COMMENT ON COLUMN user_oauth_accounts.provider_nickname IS
  'OAuth 제공자가 전달한 원본 닉네임. 서비스 표시 닉네임으로 직접 사용하지 않는다.';

COMMIT;
