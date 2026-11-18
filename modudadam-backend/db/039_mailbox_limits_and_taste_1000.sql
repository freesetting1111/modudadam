BEGIN;

CREATE TABLE IF NOT EXISTS mailbox_user_aliases (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  anonymous_alias varchar(12) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 기존 우체통 이용자에게도 사용자별 고정 ID를 배정합니다.
INSERT INTO mailbox_user_aliases(user_id,anonymous_alias)
SELECT user_id,upper(substr(replace(user_id::text,'-',''),1,12))
FROM (
  SELECT author_id AS user_id FROM mailbox_posts
  UNION
  SELECT user_id FROM mailbox_participants
) users
ON CONFLICT(user_id) DO NOTHING;

UPDATE mailbox_posts posts SET author_alias=aliases.anonymous_alias
FROM mailbox_user_aliases aliases WHERE aliases.user_id=posts.author_id;
UPDATE mailbox_participants participants SET anonymous_alias=aliases.anonymous_alias
FROM mailbox_user_aliases aliases WHERE aliases.user_id=participants.user_id;

CREATE TABLE IF NOT EXISTS mailbox_daily_submissions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_on date NOT NULL,
  post_id uuid UNIQUE REFERENCES mailbox_posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,submitted_on)
);

-- 기존 사연은 같은 날 가장 먼저 등록한 사연을 해당 사용자의 일일 사용 기록으로 이관합니다.
INSERT INTO mailbox_daily_submissions(user_id,submitted_on,post_id,created_at)
SELECT author_id,(created_at AT TIME ZONE 'Asia/Seoul')::date,id,created_at
FROM (
  SELECT posts.*,row_number() OVER(
    PARTITION BY author_id,(created_at AT TIME ZONE 'Asia/Seoul')::date ORDER BY created_at,id
  ) AS rn FROM mailbox_posts posts
) existing WHERE rn=1
ON CONFLICT(user_id,submitted_on) DO NOTHING;

-- 기존에 같은 사용자가 같은 날 여러 번 쓴 사연은 삭제하지 않고 숨김 처리합니다.
WITH duplicated AS (
  SELECT id,row_number() OVER(
    PARTITION BY author_id,(created_at AT TIME ZONE 'Asia/Seoul')::date ORDER BY created_at,id
  ) AS rn FROM mailbox_posts
)
UPDATE mailbox_posts SET status='hidden',updated_at=now()
WHERE id IN (SELECT id FROM duplicated WHERE rn>1) AND status='published';

-- 취향 발견실 추가 600문항: 기존 400문항과 합쳐 총 1,000문항을 유지합니다.
WITH contexts(text,n) AS (
  SELECT * FROM unnest(ARRAY[
    '갑자기 하루 휴가가 생겼을 때','처음 가는 카페에 들어갔을 때','오랫동안 준비한 일이 끝났을 때','친구와 여행 방식을 정할 때','새로운 팀에 합류했을 때',
    '뜻밖의 선물을 받았을 때','집에 손님을 초대하게 됐을 때','휴대폰 없이 하루를 보내야 할 때','좋아하는 가게가 문을 닫았을 때','새로운 운동을 시작할 때',
    '오래 미뤄둔 일을 시작할 때','친구의 고민을 듣게 됐을 때','내 의견과 다른 말을 들었을 때','낯선 사람과 함께 일할 때','주말에 날씨가 갑자기 바뀌었을 때',
    '예산보다 비싼 물건이 마음에 들었을 때','새로운 앱이나 도구를 배울 때','모임의 장소를 직접 정할 때','한 달 계획을 세울 때','사진을 정리하다 추억을 발견했을 때',
    '좋아하는 사람에게 마음을 전할 때','처음 보는 음식을 권유받았을 때','여러 선택지가 모두 괜찮아 보일 때','친구와 작은 갈등이 생겼을 때','예상보다 일이 잘 풀렸을 때',
    '새로운 계절의 첫 주말','혼자 장거리 이동을 하게 됐을 때','중요한 발표를 앞두었을 때','오래된 물건을 정리할 때','하루를 완전히 나답게 보낼 수 있을 때'
  ],ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30])
), dimensions(code,prompt,options) AS (
  VALUES
   ('energy','에너지를 채우기 위해 가장 가까운 선택은 무엇인가요?','[{"label":"익숙한 환경에서 혼자 충분히 쉰다","score":-2},{"label":"조용하고 편안한 방식으로 보낸다","score":-1},{"label":"그날의 컨디션에 맞춰 정한다","score":0},{"label":"가벼운 새로운 경험을 찾아본다","score":1},{"label":"낯선 자극과 활동에 적극적으로 뛰어든다","score":2}]'::jsonb),
   ('rhythm','일을 풀어가는 방식과 가장 가까운 것은 무엇인가요?','[{"label":"순서와 기준을 세밀하게 정한다","score":-2},{"label":"중요한 부분을 먼저 계획한다","score":-1},{"label":"계획과 즉흥성을 비슷하게 둔다","score":0},{"label":"상황 변화에 맞춰 자유롭게 바꾼다","score":1},{"label":"계획 없이 순간의 흐름을 따른다","score":2}]'::jsonb),
   ('social','사람과 관계 맺는 방식으로 가장 편한 것은 무엇인가요?','[{"label":"혼자 충분히 생각한 뒤 움직인다","score":-2},{"label":"가까운 한 사람과만 나눈다","score":-1},{"label":"필요에 따라 혼자 또는 함께한다","score":0},{"label":"여러 사람과 의견을 주고받는다","score":1},{"label":"새로운 사람들과 적극적으로 연결된다","score":2}]'::jsonb),
   ('expression','내 감정과 취향을 드러내는 방식은 어느 쪽인가요?','[{"label":"내 안에서 조용히 정리하고 간직한다","score":-2},{"label":"믿는 사람에게만 조심스럽게 표현한다","score":-1},{"label":"상황에 맞는 정도로 표현한다","score":0},{"label":"말과 행동으로 분명하게 보여준다","score":1},{"label":"누구나 알아볼 만큼 적극적으로 표현한다","score":2}]'::jsonb)
), viewpoints(text,n) AS (
  SELECT * FROM unnest(ARRAY['평소의 행동을 떠올리며','가장 편안한 상태를 기준으로','시간과 비용의 제약이 없다면','최근의 나를 기준으로','오래 지속할 수 있는 방식을 생각하며'],ARRAY[1,2,3,4,5])
)
INSERT INTO taste_question_bank(question_key,dimension,question,options)
SELECT format('taste-extra-%s-%s-%s',d.code,c.n,v.n),d.code,
       format('%s, %s %s',c.text,v.text,d.prompt),d.options
FROM contexts c CROSS JOIN dimensions d CROSS JOIN viewpoints v
ON CONFLICT(question_key) DO UPDATE SET question=EXCLUDED.question,options=EXCLUDED.options,enabled=true;

COMMIT;

-- 확인용
-- SELECT COUNT(*) FROM taste_question_bank WHERE enabled; -- 1000
