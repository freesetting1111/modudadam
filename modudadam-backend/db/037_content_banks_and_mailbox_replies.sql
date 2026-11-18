BEGIN;

-- 오늘의 선택: 기존 320개에 상황형 200개를 추가해 총 520개 이상을 유지합니다.
WITH situations(text,n) AS (
  SELECT * FROM unnest(ARRAY[
    '예상보다 일찍 일이 끝난 저녁','비가 조용히 내리는 휴일','아무 약속 없는 토요일 아침','기분 전환이 필요한 퇴근길','오래 기다린 휴가의 첫날',
    '친구가 갑자기 만나자고 한 날','혼자만의 시간이 생긴 오후','날씨가 유난히 좋은 주말','잠이 오지 않는 늦은 밤','월급날의 작은 보상 시간',
    '새로운 동네에 도착한 첫날','마음이 조금 지친 하루 끝','해야 할 일을 모두 끝낸 순간','오랜만에 만난 친구와의 하루','계획이 갑자기 취소된 오후',
    '계절이 바뀌는 것을 느낀 날','특별한 기념일을 앞둔 저녁','휴대폰 없이 보내는 반나절','내일 일정이 전혀 없는 밤','새로운 시작을 결심한 아침'
  ],ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20])
), dilemmas(a,ae,b,be,category,n) AS (
  SELECT * FROM unnest(
    ARRAY['좋아하는 메뉴를 다시 먹기','혼자 조용히 쉬기','사진을 많이 남기기','미리 정한 계획대로 움직이기','작지만 확실한 선물 받기','가까운 곳에서 여유롭게 보내기','한 가지 취미에 깊게 빠지기','종이책 한 권 읽기','편안한 옷을 입기','익숙한 사람과 깊게 대화하기'],
    ARRAY['🍲','🫖','📷','🗓️','🎁','🏡','🎨','📚','🧸','☕'],
    ARRAY['처음 보는 메뉴에 도전하기','사람들과 신나게 보내기','기억은 눈으로만 담기','마음이 가는 대로 즉흥적으로 움직이기','하루를 자유롭게 쓸 시간 받기','먼 곳으로 짧게 떠나기','여러 취미를 가볍게 경험하기','새로운 영상 콘텐츠 몰아보기','개성 있는 옷에 도전하기','새로운 사람과 가볍게 이야기하기'],
    ARRAY['✨','🎉','💭','🎈','⏳','🚆','🌈','🎬','🪄','👋'],
    ARRAY['음식','관계','기록','생활','선물','여행','취미','문화','패션','관계'],
    ARRAY[1,2,3,4,5,6,7,8,9,10]
  )
)
INSERT INTO choice_prompt_bank(prompt_key,category,question,description,option_a_label,option_a_emoji,option_b_label,option_b_emoji)
SELECT format('scene-%s-%s',s.n,d.n),d.category,
       format('%s, 나는 어느 쪽을 고를까?',s.text),
       format('%s와 %s 중 지금의 마음에 더 가까운 선택을 골라보세요.',d.a,d.b),
       d.a,d.ae,d.b,d.be
FROM situations s CROSS JOIN dilemmas d
ON CONFLICT(prompt_key) DO UPDATE SET question=EXCLUDED.question,description=EXCLUDED.description,
  option_a_label=EXCLUDED.option_a_label,option_a_emoji=EXCLUDED.option_a_emoji,
  option_b_label=EXCLUDED.option_b_label,option_b_emoji=EXCLUDED.option_b_emoji,enabled=true;

-- 기존 샘플 오늘 문제는 실제 문제 은행 항목으로 교체합니다. 의미가 바뀌므로 해당 샘플 투표만 초기화합니다.
WITH target AS (
  SELECT id FROM daily_choices
   WHERE active_on=(now() AT TIME ZONE 'Asia/Seoul')::date AND source_prompt_id IS NULL
), prompt AS (
  SELECT * FROM choice_prompt_bank WHERE enabled ORDER BY id DESC LIMIT 1
), cleared AS (
  DELETE FROM daily_choice_votes WHERE choice_id IN (SELECT id FROM target)
)
UPDATE daily_choices choices SET question=prompt.question,description=prompt.description,
       source_prompt_id=prompt.id,updated_at=now()
FROM target,prompt WHERE choices.id=target.id;

WITH target AS (
  SELECT choices.id,prompt.option_a_label,prompt.option_a_emoji,prompt.option_b_label,prompt.option_b_emoji
    FROM daily_choices choices JOIN choice_prompt_bank prompt ON prompt.id=choices.source_prompt_id
   WHERE choices.active_on=(now() AT TIME ZONE 'Asia/Seoul')::date
)
UPDATE daily_choice_options options SET
  label=CASE options.sort_order WHEN 1 THEN target.option_a_label ELSE target.option_b_label END,
  emoji=CASE options.sort_order WHEN 1 THEN target.option_a_emoji ELSE target.option_b_emoji END
FROM target WHERE options.choice_id=target.id AND options.sort_order IN (1,2);

-- 우체통: 한 사용자는 한 사연에 공개 답장 한 건만 유지합니다.
WITH ranked AS (
  SELECT id,row_number() OVER (PARTITION BY post_id,participant_user_id ORDER BY created_at DESC,id DESC) AS rn
  FROM mailbox_comments WHERE status='published'
)
UPDATE mailbox_comments SET status='hidden',updated_at=now()
WHERE id IN (SELECT id FROM ranked WHERE rn>1);
CREATE UNIQUE INDEX IF NOT EXISTS mailbox_comments_one_reply_per_user_idx
  ON mailbox_comments(post_id,participant_user_id) WHERE status='published';
ALTER TABLE mailbox_comments DROP CONSTRAINT IF EXISTS mailbox_comments_reply_type_check;
ALTER TABLE mailbox_comments ADD CONSTRAINT mailbox_comments_reply_type_check CHECK(reply_type IS NULL OR reply_type IN (
  'cheer','understand','helpful','empathy','thanks','together','heavy','upset','listen','respect','slowly','not_alone','no_answer','sorry','courage','rest'
));

-- 취향 발견실: 400개 문항 은행(4개 분석축 × 25개 생활상황 × 4개 질문 관점)
CREATE TABLE IF NOT EXISTS taste_question_bank (
  id bigserial PRIMARY KEY,
  question_key varchar(60) NOT NULL UNIQUE,
  dimension varchar(20) NOT NULL CHECK(dimension IN ('energy','rhythm','social','expression')),
  question varchar(300) NOT NULL,
  options jsonb NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(jsonb_typeof(options)='array' AND jsonb_array_length(options)=5)
);
CREATE INDEX IF NOT EXISTS taste_question_bank_dimension_idx ON taste_question_bank(dimension,id) WHERE enabled;

WITH contexts(text,n) AS (
  SELECT * FROM unnest(ARRAY[
    '예상보다 일찍 하루가 끝났을 때','아무 약속 없는 주말 아침','낯선 동네에 처음 도착했을 때','업무나 공부로 많이 지친 저녁','긴 휴가를 준비할 때',
    '친구에게 갑작스러운 연락이 왔을 때','새로운 취미를 시작하려 할 때','중요한 물건을 고를 때','여행지에서 일정이 비었을 때','마음이 복잡해진 날',
    '오랜만에 친구들을 만날 때','혼자 식사하게 된 날','새로운 모임에 초대받았을 때','집 안 분위기를 바꾸고 싶을 때','기억에 남는 경험을 했을 때',
    '해야 할 일이 한꺼번에 늘어났을 때','예상하지 못한 문제가 생겼을 때','계절이 바뀌어 옷을 고를 때','누군가에게 선물을 준비할 때','나만의 휴식 공간을 만들 때',
    '새로운 정보를 발견했을 때','중요한 결정을 내려야 할 때','하루 계획이 전부 취소됐을 때','오랫동안 기다린 행사를 앞두었을 때','나를 소개해야 하는 순간'
  ],ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25])
), dimensions(code,prompt,options) AS (
  VALUES
   ('energy','어떤 선택에서 가장 편안한 에너지를 얻나요?','[{"label":"익숙한 공간에서 혼자 충분히 쉰다","score":-2},{"label":"가까운 곳에서 조용히 시간을 보낸다","score":-1},{"label":"그날의 상태를 보고 정한다","score":0},{"label":"궁금한 곳 한 군데를 찾아간다","score":1},{"label":"새로운 경험으로 시간을 가득 채운다","score":2}]'::jsonb),
   ('rhythm','어떤 방식으로 움직일 때 마음이 편한가요?','[{"label":"순서와 시간을 구체적으로 정한다","score":-2},{"label":"중요한 부분을 미리 준비한다","score":-1},{"label":"기본 계획과 여유를 반반 둔다","score":0},{"label":"상황을 보며 유연하게 바꾼다","score":1},{"label":"첫 느낌과 흐름에 맡긴다","score":2}]'::jsonb),
   ('social','사람과의 거리는 어느 정도가 가장 자연스러운가요?','[{"label":"혼자 생각하고 결정하는 편이 좋다","score":-2},{"label":"가까운 한 사람과만 나누고 싶다","score":-1},{"label":"상황에 따라 혼자 또는 함께한다","score":0},{"label":"여럿과 의견을 나누고 싶다","score":1},{"label":"새로운 사람들과 적극적으로 어울리고 싶다","score":2}]'::jsonb),
   ('expression','내 취향과 감정을 어떻게 드러내고 싶나요?','[{"label":"내 안에 조용히 간직한다","score":-2},{"label":"필요한 사람에게만 살짝 보여준다","score":-1},{"label":"상황에 맞게 적당히 표현한다","score":0},{"label":"사진이나 말로 분명히 표현한다","score":1},{"label":"누구나 알 수 있게 적극적으로 드러낸다","score":2}]'::jsonb)
), viewpoints(text,n) AS (
  SELECT * FROM unnest(ARRAY['지금의 나를 기준으로','가장 자연스러운 모습을 떠올리며','부담이 전혀 없다고 가정하고','평소 반복되는 선택을 생각하며'],ARRAY[1,2,3,4])
)
INSERT INTO taste_question_bank(question_key,dimension,question,options)
SELECT format('taste-%s-%s-%s',d.code,c.n,v.n),d.code,
       format('%s, %s %s',c.text,v.text,d.prompt),d.options
FROM contexts c CROSS JOIN dimensions d CROSS JOIN viewpoints v
ON CONFLICT(question_key) DO UPDATE SET question=EXCLUDED.question,options=EXCLUDED.options,enabled=true;

COMMIT;

-- 확인용
-- SELECT COUNT(*) FROM choice_prompt_bank WHERE enabled;       -- 520 이상
-- SELECT COUNT(*) FROM taste_question_bank WHERE enabled;      -- 400
