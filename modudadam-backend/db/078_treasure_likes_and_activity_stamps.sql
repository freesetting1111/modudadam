BEGIN;

-- 장소별 회원 좋아요입니다. 한 회원은 한 장소에 한 번만 표시할 수 있습니다.
CREATE TABLE IF NOT EXISTS local_treasure_likes (
  treasure_id uuid NOT NULL REFERENCES local_treasures(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (treasure_id,user_id)
);
CREATE INDEX IF NOT EXISTS local_treasure_likes_user_idx
  ON local_treasure_likes(user_id,created_at DESC);

CREATE OR REPLACE FUNCTION prevent_local_treasure_self_like() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM local_treasures
    WHERE id=NEW.treasure_id AND author_id=NEW.user_id
  ) THEN
    RAISE EXCEPTION '본인이 등록한 장소에는 좋아요를 누를 수 없습니다.'
      USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS local_treasure_likes_no_self ON local_treasure_likes;
CREATE TRIGGER local_treasure_likes_no_self
BEFORE INSERT ON local_treasure_likes
FOR EACH ROW EXECUTE FUNCTION prevent_local_treasure_self_like();

-- 활동 업적 스탬프: 난이도에 따라 100회 활동은 영웅, 100일/100좋아요는 전설로 구분합니다.
INSERT INTO attendance_stamp_catalog
  (code,name,emoji,description,price,sort_order,rarity,enabled,access_scope)
VALUES
  ('achievement_detective_100','백 번째 진실','/brand/stamps/catalog/v8/epic-achievement_detective_100.svg','다담 추리방 사건 100개를 해결한 기록',0,910,'epic',true,'achievement'),
  ('achievement_mission_100','백 번의 완수','/brand/stamps/catalog/v8/epic-achievement_mission_100.svg','다담 미션 100개를 완료한 기록',0,920,'epic',true,'achievement'),
  ('achievement_treasure_100','동네의 별','/brand/stamps/catalog/v8/legendary-achievement_treasure_100.svg','동네 보물지도에서 좋아요 100개를 받은 기록',0,930,'legendary',true,'achievement'),
  ('achievement_challenge_100','백일의 약속','/brand/stamps/catalog/v8/legendary-achievement_challenge_100.svg','다담 챌린지를 서로 다른 100일 동안 실천한 기록',0,940,'legendary',true,'achievement')
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,
  emoji=EXCLUDED.emoji,
  description=EXCLUDED.description,
  price=EXCLUDED.price,
  sort_order=EXCLUDED.sort_order,
  rarity=EXCLUDED.rarity,
  enabled=true,
  access_scope='achievement';

CREATE TABLE IF NOT EXISTS activity_stamp_achievement_catalog (
  code varchar(40) PRIMARY KEY,
  stamp_code varchar(30) NOT NULL UNIQUE REFERENCES attendance_stamp_catalog(code),
  metric_type varchar(40) NOT NULL UNIQUE CHECK (metric_type IN (
    'detective_solved','mission_completed','treasure_likes_received','challenge_checkin_days'
  )),
  threshold integer NOT NULL CHECK (threshold > 0),
  sort_order smallint NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO activity_stamp_achievement_catalog
  (code,stamp_code,metric_type,threshold,sort_order,enabled)
VALUES
  ('detective-century','achievement_detective_100','detective_solved',100,10,true),
  ('mission-century','achievement_mission_100','mission_completed',100,20,true),
  ('treasure-century','achievement_treasure_100','treasure_likes_received',100,30,true),
  ('challenge-century','achievement_challenge_100','challenge_checkin_days',100,40,true)
ON CONFLICT(code) DO UPDATE SET
  stamp_code=EXCLUDED.stamp_code,
  metric_type=EXCLUDED.metric_type,
  threshold=EXCLUDED.threshold,
  sort_order=EXCLUDED.sort_order,
  enabled=EXCLUDED.enabled,
  updated_at=now();

CREATE OR REPLACE FUNCTION grant_activity_achievement_stamps(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql AS $$
DECLARE
  awarded_count integer := 0;
BEGIN
  -- 서로 다른 장소에서 동시에 100번째 좋아요가 들어와도 집계가 빠지지 않도록 회원별로 직렬화합니다.
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

CREATE OR REPLACE FUNCTION grant_detective_activity_stamp() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='solved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM grant_activity_achievement_stamps(NEW.user_id);
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS detective_activity_stamp_after_solve ON detective_daily_attempts;
CREATE TRIGGER detective_activity_stamp_after_solve
AFTER UPDATE OF status ON detective_daily_attempts
FOR EACH ROW EXECUTE FUNCTION grant_detective_activity_stamp();

CREATE OR REPLACE FUNCTION grant_mission_activity_stamp() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    PERFORM grant_activity_achievement_stamps(NEW.user_id);
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS mission_activity_stamp_after_complete ON daily_mission_attempts;
CREATE TRIGGER mission_activity_stamp_after_complete
AFTER UPDATE OF completed_at ON daily_mission_attempts
FOR EACH ROW EXECUTE FUNCTION grant_mission_activity_stamp();

CREATE OR REPLACE FUNCTION grant_treasure_activity_stamp() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  treasure_author_id uuid;
BEGIN
  SELECT author_id INTO treasure_author_id
  FROM local_treasures WHERE id=NEW.treasure_id;
  IF treasure_author_id IS NOT NULL THEN
    PERFORM grant_activity_achievement_stamps(treasure_author_id);
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS treasure_activity_stamp_after_like ON local_treasure_likes;
CREATE TRIGGER treasure_activity_stamp_after_like
AFTER INSERT ON local_treasure_likes
FOR EACH ROW EXECUTE FUNCTION grant_treasure_activity_stamp();

CREATE OR REPLACE FUNCTION grant_challenge_activity_stamp() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  challenge_user_id uuid;
BEGIN
  SELECT user_id INTO challenge_user_id
  FROM challenge_enrollments WHERE id=NEW.enrollment_id;
  IF challenge_user_id IS NOT NULL THEN
    PERFORM grant_activity_achievement_stamps(challenge_user_id);
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS challenge_activity_stamp_after_checkin ON challenge_checkins;
CREATE TRIGGER challenge_activity_stamp_after_checkin
AFTER INSERT ON challenge_checkins
FOR EACH ROW EXECUTE FUNCTION grant_challenge_activity_stamp();

-- 기존 활동 기록도 배포 시 한 번 소급 반영합니다.
SELECT grant_activity_achievement_stamps(candidate.user_id)
FROM (
  SELECT user_id FROM detective_daily_attempts WHERE status='solved'
  UNION
  SELECT user_id FROM daily_mission_attempts WHERE completed_at IS NOT NULL
  UNION
  SELECT treasures.author_id AS user_id
  FROM local_treasure_likes likes JOIN local_treasures treasures ON treasures.id=likes.treasure_id
  UNION
  SELECT enrollments.user_id
  FROM challenge_checkins checkins JOIN challenge_enrollments enrollments ON enrollments.id=checkins.enrollment_id
) candidate;

COMMENT ON TABLE local_treasure_likes IS '동네 보물지도 장소별 회원 좋아요';
COMMENT ON TABLE activity_stamp_achievement_catalog IS '서버 활동 기록으로 자동 지급하는 특별 스탬프 기준';
COMMENT ON FUNCTION grant_activity_achievement_stamps(uuid) IS '회원 활동 합계를 검증하고 달성한 스탬프를 한 번만 지급';

COMMIT;
