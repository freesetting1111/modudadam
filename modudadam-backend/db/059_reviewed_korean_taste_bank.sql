BEGIN;

-- 기계 번역 문항을 출제 대상에서 제외하고, 문법과 의미를 검수한 한국어 상황형 문항으로 교체합니다.
-- 기존 문항과 응답 이력은 삭제하지 않습니다.
ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS source_name varchar(80);
ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS source_item_id varchar(120);
ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS source_license varchar(40);
ALTER TABLE taste_question_bank ADD COLUMN IF NOT EXISTS construct varchar(120);

ALTER TABLE taste_question_bank DROP CONSTRAINT IF EXISTS taste_question_bank_dimension_check;
ALTER TABLE taste_question_bank ADD CONSTRAINT taste_question_bank_dimension_check
  CHECK (dimension IN (
    -- 기존 원본 문항과 응답 이력을 보존하기 위한 레거시 분석축
    'energy','rhythm','social','expression',
    -- 현재 취향 발견실에서 사용하는 Big Five 분석축
    'neuroticism','extraversion','openness','agreeableness','conscientiousness'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS taste_question_bank_source_item_idx
  ON taste_question_bank(source_name,source_item_id) WHERE source_item_id IS NOT NULL;

-- 원본 데이터는 보존하되, 검수되지 않은 직역 문항은 더 이상 노출하지 않습니다.
UPDATE taste_question_bank
   SET enabled=false
 WHERE source_name IS DISTINCT FROM 'MODUDADAM-KO-BIG5-V1';

WITH contexts(dimension,context_no,context) AS (
  SELECT 'neuroticism',n::int,text FROM unnest(ARRAY[
    '중요한 결과를 기다리고 있을 때','사람들 앞에서 실수했을 때','예정된 계획이 갑자기 바뀌었을 때','누군가 내 의견을 강하게 반박했을 때','해야 할 일이 한꺼번에 몰렸을 때',
    '낯선 환경에 적응해야 할 때','정답이 없는 결정을 내려야 할 때','가까운 사람의 반응이 평소보다 차가울 때','오랫동안 준비한 일이 뜻대로 되지 않았을 때','충분히 쉬지 못한 채 하루를 시작할 때'
  ]) WITH ORDINALITY c(text,n)
  UNION ALL
  SELECT 'extraversion',n::int,text FROM unnest(ARRAY[
    '처음 보는 사람들이 모인 자리에 갔을 때','친구들과 주말 계획을 세울 때','회의나 모임에서 대화가 끊겼을 때','새로운 동료나 이웃을 만났을 때','여러 사람이 함께하는 행사에 참여했을 때',
    '내가 잘 아는 주제로 이야기가 시작됐을 때','모임에서 진행할 사람이 필요할 때','오랜만에 자유 시간이 생겼을 때','낯선 사람과 같은 공간에 오래 있어야 할 때','좋은 소식이나 재미있는 경험이 생겼을 때'
  ]) WITH ORDINALITY c(text,n)
  UNION ALL
  SELECT 'openness',n::int,text FROM unnest(ARRAY[
    '익숙하지 않은 분야의 콘텐츠를 발견했을 때','여행지에서 예상하지 못한 장소를 발견했을 때','기존 방식으로 문제가 잘 풀리지 않을 때','새로운 취미를 권유받았을 때','서로 다른 해석이 가능한 작품을 접했을 때',
    '평소와 전혀 다른 의견을 들었을 때','방이나 작업 공간의 분위기를 바꾸고 싶을 때','처음 보는 음식이나 문화를 만났을 때','시간과 비용에 여유가 생겼을 때','일상에서 반복되는 선택이 지루하게 느껴질 때'
  ]) WITH ORDINALITY c(text,n)
  UNION ALL
  SELECT 'agreeableness',n::int,text FROM unnest(ARRAY[
    '친한 사람과 의견이 엇갈렸을 때','누군가 내 도움을 필요로 할 때','상대가 약속 시간에 늦었을 때','팀에서 실수한 사람이 생겼을 때','내 몫보다 조금 더 많은 일을 맡게 됐을 때',
    '누군가 속상한 마음을 털어놓을 때','공동으로 사용할 물건이나 공간을 정리할 때','상대가 내 말을 오해했을 때','내가 원하는 것과 모두에게 좋은 선택이 다를 때','잘 모르는 사람이 곤란한 상황에 놓였을 때'
  ]) WITH ORDINALITY c(text,n)
  UNION ALL
  SELECT 'conscientiousness',n::int,text FROM unnest(ARRAY[
    '마감이 있는 일을 새로 맡았을 때','여러 할 일을 동시에 처리해야 할 때','한 달 이상 이어지는 계획을 시작할 때','중요한 약속이나 일정을 앞두었을 때','예상보다 시간이 부족해졌을 때',
    '반복해서 확인해야 하는 작업을 할 때','목표를 이루기까지 시간이 오래 걸릴 때','정리되지 않은 자료를 넘겨받았을 때','하고 싶은 일과 해야 할 일이 겹쳤을 때','누가 확인하지 않아도 끝까지 책임져야 할 때'
  ]) WITH ORDINALITY c(text,n)
), statements(dimension,statement_no,statement,reverse_scored,construct) AS (
  SELECT 'neuroticism',n::int,text,n>10,'정서 안정성' FROM unnest(ARRAY[
    '나는 걱정이 오래 이어지는 편이다.','나는 긴장이 쉽게 풀리지 않는 편이다.','나는 작은 실수도 계속 떠올리는 편이다.','나는 좋지 않은 결과부터 상상하는 편이다.','나는 감정이 흔들리면 회복하는 데 시간이 걸린다.',
    '나는 압박을 받으면 마음이 급해지는 편이다.','나는 불확실한 상태를 견디기 어려워한다.','나는 다른 사람의 반응을 지나치게 신경 쓰는 편이다.','나는 한번 속상하면 그 기분이 오래 남는다.','나는 몸과 마음이 쉽게 지치는 편이다.',
    '나는 차분하게 상황을 정리하는 편이다.','나는 걱정이 생겨도 해야 할 일에 다시 집중한다.','나는 실수한 뒤 필요한 교훈만 남기고 넘기는 편이다.','나는 감정이 흔들려도 비교적 빨리 안정을 찾는다.','나는 불확실해도 당장 할 수 있는 일부터 찾는다.',
    '나는 압박 속에서도 호흡을 고르고 판단한다.','나는 좋지 않은 가능성만 확대해서 생각하지 않는다.','나는 다른 사람의 반응과 내 가치를 분리해서 본다.','나는 예상 밖의 변화에도 침착함을 유지한다.','나는 힘든 일이 있어도 회복할 방법을 찾는 편이다.'
  ]) WITH ORDINALITY s(text,n)
  UNION ALL
  SELECT 'extraversion',n::int,text,n>10,'사회적 활력' FROM unnest(ARRAY[
    '나는 먼저 말을 걸어 대화를 시작하는 편이다.','나는 여러 사람과 어울릴수록 에너지가 생긴다.','나는 생각이나 경험을 말로 나누는 것을 즐긴다.','나는 모임의 분위기를 살리는 역할을 자주 한다.','나는 새로운 사람을 알아가는 과정이 즐겁다.',
    '나는 사람들 앞에서 의견을 말하는 것이 편하다.','나는 활동적인 약속이 많아도 즐거운 편이다.','나는 관심 있는 일에 주변 사람을 적극적으로 초대한다.','나는 대화에서 반응과 표현이 풍부한 편이다.','나는 혼자 있기보다 누군가와 함께하는 쪽을 고른다.',
    '나는 먼저 말을 걸기보다 상대가 다가오기를 기다린다.','나는 많은 사람과 오래 있으면 혼자 쉬는 시간이 필요하다.','나는 생각을 말하기 전에 혼자 정리하는 편이다.','나는 모임에서 눈에 띄지 않는 자리가 편하다.','나는 새로운 관계를 천천히 시작하는 편이다.',
    '나는 사람들 앞에서 즉석으로 말하는 일을 부담스러워한다.','나는 약속이 이어지면 조용히 쉬고 싶어진다.','나는 관심 있는 일도 혼자 해보는 쪽이 편하다.','나는 감정이나 반응을 크게 드러내지 않는 편이다.','나는 여러 사람과 함께하기보다 혼자 보내는 시간을 선호한다.'
  ]) WITH ORDINALITY s(text,n)
  UNION ALL
  SELECT 'openness',n::int,text,n>10,'경험 개방성' FROM unnest(ARRAY[
    '나는 새로운 관점이 나오면 이유부터 궁금해진다.','나는 익숙하지 않은 경험도 한번 시도해 보는 편이다.','나는 하나의 문제를 여러 방식으로 바라보는 것을 즐긴다.','나는 예술 작품이나 이야기의 숨은 의미를 생각해 본다.','나는 낯선 분야를 배우는 과정에서 재미를 느낀다.',
    '나는 기존 규칙보다 더 나은 방법이 있는지 탐색한다.','나는 상상력을 활용하는 활동을 좋아한다.','나는 다른 문화와 생활방식을 알아보는 데 관심이 많다.','나는 익숙한 선택보다 새로운 가능성에 끌리는 편이다.','나는 당연하게 여겨온 생각에도 질문을 던지는 편이다.',
    '나는 검증된 방식이 있으면 그대로 따르는 편이다.','나는 낯선 경험보다 익숙하고 예측 가능한 선택이 편하다.','나는 한 번 효과가 있었던 방법을 계속 사용하는 편이다.','나는 작품의 의미를 깊게 해석하기보다 있는 그대로 즐긴다.','나는 관심 분야가 아니면 새로 배우려는 마음이 크지 않다.',
    '나는 새로운 방식보다 정해진 절차가 편하다.','나는 상상보다는 현실적으로 바로 쓸 수 있는 것을 선호한다.','나는 다른 문화보다 익숙한 생활방식에 더 마음이 간다.','나는 선택할 때 새로움보다 안정성을 우선한다.','나는 기존 생각을 다시 검토할 필요를 크게 느끼지 않는다.'
  ]) WITH ORDINALITY s(text,n)
  UNION ALL
  SELECT 'agreeableness',n::int,text,n>10,'관계 협력성' FROM unnest(ARRAY[
    '나는 상대의 입장을 먼저 이해하려고 한다.','나는 갈등이 생기면 서로 받아들일 수 있는 지점을 찾는다.','나는 도움이 필요한 사람을 그냥 지나치기 어렵다.','나는 상대가 실수했을 때 바로 비난하기보다 사정을 듣는다.','나는 내 이익이 조금 줄어도 공정한 선택을 하려고 한다.',
    '나는 상대의 말을 끝까지 듣고 답하는 편이다.','나는 고마움이나 미안함을 분명하게 표현한다.','나는 협력해야 할 때 맡은 몫 이상으로 도울 수 있다.','나는 사람을 쉽게 의심하기보다 먼저 믿어보는 편이다.','나는 불편한 상황에서도 예의를 지키려고 한다.',
    '나는 상대보다 내 입장을 먼저 관철하려는 편이다.','나는 갈등이 생기면 타협보다 이기는 것이 중요하다고 느낀다.','나는 남의 어려움에 크게 관여하지 않는 편이다.','나는 상대가 실수하면 이유보다 책임부터 따지는 편이다.','나는 공정함보다 내게 유리한 선택을 우선할 때가 많다.',
    '나는 상대의 말을 듣는 중에도 반박할 내용을 먼저 생각한다.','나는 고맙거나 미안해도 굳이 표현하지 않는 편이다.','나는 정해진 내 몫만 하면 충분하다고 생각한다.','나는 사람을 믿기 전에 의심부터 하는 편이다.','나는 불편하면 예의보다 솔직한 감정을 먼저 드러낸다.'
  ]) WITH ORDINALITY s(text,n)
  UNION ALL
  SELECT 'conscientiousness',n::int,text,n>10,'계획 실행력' FROM unnest(ARRAY[
    '나는 해야 할 일을 작은 단계로 나누어 시작한다.','나는 중요한 일의 마감과 순서를 미리 확인한다.','나는 맡은 일을 끝낼 때까지 꾸준히 진행한다.','나는 실수를 줄이기 위해 결과를 다시 점검한다.','나는 사용한 물건과 자료를 정해진 자리에 정리한다.',
    '나는 방해 요소가 있어도 우선순위에 따라 움직인다.','나는 장기 목표를 위해 당장의 즐거움을 조절할 수 있다.','나는 약속한 시간과 기준을 지키려고 한다.','나는 시작한 일을 미루지 않고 마무리하는 편이다.','나는 예상 밖의 문제가 생기면 계획을 다시 세운다.',
    '나는 계획을 세워도 그날 기분에 따라 미루는 편이다.','나는 마감이 가까워져야 본격적으로 시작하는 편이다.','나는 반복되는 일은 중간에 집중력이 쉽게 흐트러진다.','나는 결과를 확인하지 않고 끝냈다고 생각할 때가 많다.','나는 물건이나 자료를 어디에 두었는지 자주 잊는다.',
    '나는 급한 일부터 처리하다 중요한 일을 놓칠 때가 있다.','나는 먼 목표보다 당장의 편안함을 우선하는 편이다.','나는 시간 약속에 조금 늦는 것을 대수롭지 않게 여긴다.','나는 흥미가 떨어지면 시작한 일을 남겨두는 편이다.','나는 계획이 틀어지면 다시 정리하기보다 손을 놓을 때가 있다.'
  ]) WITH ORDINALITY s(text,n)
), generated AS (
  SELECT
    format('taste-ko-v1-%s-%s-%s',c.dimension,c.context_no,s.statement_no) AS question_key,
    c.dimension,
    format('%s, %s',c.context,s.statement) AS question,
    CASE WHEN s.reverse_scored THEN
      '[{"label":"전혀 그렇지 않다","score":2},{"label":"그렇지 않은 편이다","score":1},{"label":"보통이다","score":0},{"label":"그런 편이다","score":-1},{"label":"매우 그렇다","score":-2}]'::jsonb
    ELSE
      '[{"label":"전혀 그렇지 않다","score":-2},{"label":"그렇지 않은 편이다","score":-1},{"label":"보통이다","score":0},{"label":"그런 편이다","score":1},{"label":"매우 그렇다","score":2}]'::jsonb
    END AS options,
    format('%s-%s-%s',c.dimension,c.context_no,s.statement_no) AS source_item_id,
    s.construct
  FROM contexts c
  JOIN statements s ON s.dimension=c.dimension
)
INSERT INTO taste_question_bank(
  question_key,dimension,question,options,enabled,source_name,source_item_id,source_license,construct
)
SELECT question_key,dimension,question,options,true,'MODUDADAM-KO-BIG5-V1',source_item_id,'Original',construct
FROM generated
ON CONFLICT(question_key) DO UPDATE SET
  dimension=EXCLUDED.dimension,
  question=EXCLUDED.question,
  options=EXCLUDED.options,
  enabled=true,
  source_name=EXCLUDED.source_name,
  source_item_id=EXCLUDED.source_item_id,
  source_license=EXCLUDED.source_license,
  construct=EXCLUDED.construct;

DO $$
DECLARE
  total_count integer;
  dimension_count integer;
  question_count integer;
  invalid_option_count integer;
BEGIN
  SELECT count(*),count(DISTINCT dimension),count(DISTINCT question)
    INTO total_count,dimension_count,question_count
    FROM taste_question_bank
   WHERE enabled AND source_name='MODUDADAM-KO-BIG5-V1';

  SELECT count(*) INTO invalid_option_count
    FROM taste_question_bank
   WHERE enabled
     AND source_name='MODUDADAM-KO-BIG5-V1'
     AND (jsonb_typeof(options)<>'array' OR jsonb_array_length(options)<>5);

  IF total_count<>1000 OR dimension_count<>5 OR question_count<>1000 OR invalid_option_count<>0 THEN
    RAISE EXCEPTION '한국어 취향 문항 검증 실패: total %, dimensions %, unique questions %, invalid options %',
      total_count,dimension_count,question_count,invalid_option_count;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM (
        SELECT dimension,count(*) AS item_count
          FROM taste_question_bank
         WHERE enabled AND source_name='MODUDADAM-KO-BIG5-V1'
         GROUP BY dimension
      ) checked
     WHERE item_count<>200
  ) THEN
    RAISE EXCEPTION '한국어 취향 문항은 분석축마다 200개여야 합니다.';
  END IF;
END $$;

COMMIT;

-- 확인용
-- SELECT dimension,count(*) FROM taste_question_bank
-- WHERE enabled AND source_name='MODUDADAM-KO-BIG5-V1' GROUP BY dimension ORDER BY dimension;
