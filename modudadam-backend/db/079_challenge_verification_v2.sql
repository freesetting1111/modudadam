BEGIN;

-- 챌린지마다 실제 행동에 맞는 구조화된 인증 항목을 정의합니다.
ALTER TABLE dadam_challenges
  ADD COLUMN IF NOT EXISTS verification_type varchar(30) NOT NULL DEFAULT 'reflection',
  ADD COLUMN IF NOT EXISTS verification_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE dadam_challenges
  DROP CONSTRAINT IF EXISTS dadam_challenges_verification_type_check;
ALTER TABLE dadam_challenges
  ADD CONSTRAINT dadam_challenges_verification_type_check
  CHECK (verification_type IN ('duration','quantity','duration_choice','two_text','reading','reflection'));

UPDATE dadam_challenges SET
  verification_type='duration',
  verification_config='{"amountLabel":"산책 시간","unit":"분","min":10,"max":300,"detailLabel":"오늘 걸은 장소나 코스 (선택)","detailRequired":false}'::jsonb
WHERE slug='ten-minute-walk';

UPDATE dadam_challenges SET
  verification_type='quantity',
  verification_config='{"amountLabel":"평소보다 더 마신 물","unit":"잔","min":1,"max":10}'::jsonb
WHERE slug='one-more-water';

UPDATE dadam_challenges SET
  verification_type='two_text',
  verification_config='{"subjectLabel":"사용한 재료","resultLabel":"만든 음식이나 처리 방법","subjectMin":2,"resultMin":4}'::jsonb
WHERE slug='empty-fridge';

UPDATE dadam_challenges SET
  verification_type='duration_choice',
  verification_config='{"amountLabel":"함께한 시간","unit":"분","min":10,"max":240,"choiceLabel":"오늘 한 활동","options":["놀이","산책","훈련","돌봄"],"detailLabel":"오늘의 한마디 (선택)","detailRequired":false}'::jsonb
WHERE slug='happy-pet-time';

UPDATE dadam_challenges SET
  verification_type='reading',
  verification_config='{"amountLabel":"읽은 분량","unit":"쪽","min":1,"max":500,"detailLabel":"기억에 남은 내용","detailMin":5,"detailRequired":true}'::jsonb
WHERE slug='one-page-day';

UPDATE dadam_challenges SET
  verification_type='duration_choice',
  verification_config='{"amountLabel":"정리한 시간","unit":"분","min":10,"max":180,"choiceLabel":"정리한 공간","options":["책상","주방","옷장","거실","욕실","기타"],"detailLabel":"정리한 내용 (선택)","detailRequired":false}'::jsonb
WHERE slug='ten-minute-tidy';

-- 향후 추가되는 챌린지는 최소한 구체적인 한 줄 기록을 요구합니다.
UPDATE dadam_challenges
SET verification_config='{"detailLabel":"오늘 실천한 내용","detailMin":10,"detailRequired":true}'::jsonb
WHERE verification_type='reflection' AND verification_config='{}'::jsonb;

-- 하루 입력 자체에는 보상을 주지 않고, 목표 일수를 채운 회차에만 완료 보상을 지급합니다.
UPDATE dadam_challenges SET daily_acorns=0 WHERE daily_acorns<>0;

-- 완료·만료 후 동일 챌린지를 다시 시작할 수 있도록 회차를 분리합니다.
ALTER TABLE challenge_enrollments
  ADD COLUMN IF NOT EXISTS round_no integer NOT NULL DEFAULT 1 CHECK (round_no > 0);

ALTER TABLE challenge_enrollments
  DROP CONSTRAINT IF EXISTS challenge_enrollments_challenge_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS challenge_enrollments_round_uidx
  ON challenge_enrollments(challenge_id,user_id,round_no);
CREATE UNIQUE INDEX IF NOT EXISTS challenge_enrollments_one_active_uidx
  ON challenge_enrollments(challenge_id,user_id) WHERE status='active';

-- 과거 인증은 그대로 인정하고, 신규 인증부터 구조화된 근거를 저장합니다.
ALTER TABLE challenge_checkins
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_status varchar(20) NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

UPDATE challenge_checkins
SET evidence=CASE
      WHEN note IS NULL OR btrim(note)='' THEN '{}'::jsonb
      ELSE jsonb_build_object('legacyNote',note)
    END,
    verification_status='verified',
    verified_at=COALESCE(verified_at,created_at)
WHERE verified_at IS NULL OR evidence='{}'::jsonb;

ALTER TABLE challenge_checkins
  DROP CONSTRAINT IF EXISTS challenge_checkins_verification_status_check;
ALTER TABLE challenge_checkins
  ADD CONSTRAINT challenge_checkins_verification_status_check
  CHECK (verification_status IN ('verified','rejected'));

CREATE INDEX IF NOT EXISTS challenge_checkins_verified_idx
  ON challenge_checkins(enrollment_id,checkin_on)
  WHERE verification_status='verified';

-- 100일 업적은 검증된 인증 날짜만 집계하도록 기존 지급 함수를 갱신합니다.
CREATE OR REPLACE FUNCTION grant_activity_achievement_stamps(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  awarded_count integer := 0;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(target_user_id::text,0));

  WITH progress AS (
    SELECT achievement.stamp_code,achievement.threshold,
      CASE achievement.metric_type
        WHEN 'detective_solved' THEN (
          SELECT count(*) FROM detective_daily_attempts
          WHERE user_id=target_user_id AND status='solved'
        )
        WHEN 'mission_completed' THEN (
          SELECT count(*) FROM daily_mission_attempts
          WHERE user_id=target_user_id AND completed_at IS NOT NULL
        )
        WHEN 'treasure_likes_received' THEN (
          SELECT count(*) FROM local_treasure_likes likes
          JOIN local_treasures treasures ON treasures.id=likes.treasure_id
          WHERE treasures.author_id=target_user_id AND treasures.status='published'
        )
        WHEN 'challenge_checkin_days' THEN (
          SELECT count(DISTINCT checkins.checkin_on)
          FROM challenge_checkins checkins
          JOIN challenge_enrollments enrollments ON enrollments.id=checkins.enrollment_id
          WHERE enrollments.user_id=target_user_id
            AND checkins.verification_status='verified'
        )
        ELSE 0
      END AS current_value
    FROM activity_stamp_achievement_catalog achievement
    WHERE achievement.enabled
  ), awarded AS (
    INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped)
    SELECT target_user_id,progress.stamp_code,false
    FROM progress
    WHERE progress.current_value >= progress.threshold
    ON CONFLICT(user_id,stamp_code) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer INTO awarded_count FROM awarded;

  RETURN awarded_count;
END
$$;

COMMENT ON COLUMN dadam_challenges.verification_type IS '챌린지 인증 입력 형식';
COMMENT ON COLUMN dadam_challenges.verification_config IS '최소값, 단위, 선택지 등 서버 검증과 화면에 공통으로 쓰는 설정';
COMMENT ON COLUMN challenge_enrollments.round_no IS '동일 챌린지 재도전 회차';
COMMENT ON COLUMN challenge_checkins.evidence IS '서버 검증을 통과한 구조화된 실천 기록';
COMMENT ON COLUMN challenge_checkins.verification_status IS '진행률과 업적에 포함할 인증 상태';

COMMIT;
