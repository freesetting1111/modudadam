BEGIN;

CREATE TABLE IF NOT EXISTS mission_question_concepts (
  category_code varchar(50) NOT NULL REFERENCES categories(code),
  concept_key varchar(50) NOT NULL,
  term varchar(100) NOT NULL,
  fact varchar(500) NOT NULL,
  sort_order smallint NOT NULL,
  PRIMARY KEY(category_code,concept_key)
);

CREATE TABLE IF NOT EXISTS mission_question_bank (
  id bigserial PRIMARY KEY,
  category_code varchar(50) NOT NULL REFERENCES categories(code),
  concept_key varchar(50) NOT NULL,
  variant_no smallint NOT NULL CHECK (variant_no BETWEEN 1 AND 20),
  question varchar(500) NOT NULL,
  options jsonb NOT NULL CHECK (jsonb_array_length(options)=4),
  correct_index smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation varchar(1000) NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  UNIQUE(category_code,concept_key,variant_no),
  FOREIGN KEY(category_code,concept_key) REFERENCES mission_question_concepts(category_code,concept_key) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mission_question_bank_category_idx ON mission_question_bank(category_code,variant_no) WHERE enabled;

CREATE TABLE IF NOT EXISTS daily_mission_questions (
  mission_on date NOT NULL,
  category_code varchar(50) NOT NULL REFERENCES categories(code),
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 10),
  question_id bigint NOT NULL REFERENCES mission_question_bank(id),
  PRIMARY KEY(mission_on,category_code,slot),
  UNIQUE(mission_on,category_code,question_id)
);

CREATE TABLE IF NOT EXISTS daily_mission_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_code varchar(50) NOT NULL REFERENCES categories(code),
  mission_on date NOT NULL,
  question_ids bigint[] NOT NULL CHECK (cardinality(question_ids)=3),
  attempt_count integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  rewarded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,category_code,mission_on)
);

ALTER TABLE acorn_transactions DROP CONSTRAINT IF EXISTS acorn_transactions_transaction_type_check;
ALTER TABLE acorn_transactions ADD CONSTRAINT acorn_transactions_transaction_type_check
  CHECK (transaction_type IN ('attendance','attendance_bonus','challenge_checkin','challenge_complete','mission_complete','stamp_purchase'));

INSERT INTO mission_question_concepts(category_code,concept_key,term,fact,sort_order) VALUES
('pets','body_language','반려견의 편안한 몸짓','몸 전체에 힘이 빠지고 꼬리를 자연스럽게 흔드는 모습은 대체로 편안한 상태를 뜻합니다.',1),
('pets','cat_tail','고양이 꼬리 세우기','고양이가 꼬리를 곧게 세우고 다가오는 행동은 반가움과 친근함을 표현하는 경우가 많습니다.',2),
('pets','chocolate','초콜릿과 반려견','초콜릿의 테오브로민 성분은 반려견에게 위험할 수 있어 먹이지 말아야 합니다.',3),
('pets','water','반려동물 음수 관리','깨끗한 물을 언제든 마실 수 있도록 매일 물그릇을 씻고 새 물로 바꾸는 것이 좋습니다.',4),
('pets','walk_heat','더운 날 산책','더운 날에는 손등으로 바닥 온도를 확인하고 한낮을 피해 산책해야 발바닥 화상을 줄일 수 있습니다.',5),
('pets','microchip','동물등록','동물등록은 반려동물을 잃어버렸을 때 보호자를 찾는 데 도움을 줍니다.',6),
('pets','onion','양파와 반려동물','양파와 파 종류는 개와 고양이의 적혈구에 손상을 줄 수 있어 급여하면 안 됩니다.',7),
('pets','nail','발톱 관리','발톱이 지나치게 길면 걸음걸이와 관절에 부담을 줄 수 있어 정기적인 확인이 필요합니다.',8),
('pets','new_food','새 사료 전환','새 사료는 기존 사료와 섞어 며칠에 걸쳐 비율을 늘리면 소화 불편을 줄이는 데 도움이 됩니다.',9),
('pets','id_tag','인식표','연락처가 적힌 인식표는 실종 시 빠른 귀가 가능성을 높이는 기본 안전장치입니다.',10),
('food','cross_contamination','교차오염 방지','생고기용 도마와 바로 먹는 식품용 도마를 구분하면 교차오염 위험을 줄일 수 있습니다.',1),
('food','hand_wash','조리 전 손 씻기','조리 전후에는 흐르는 물과 비누로 손을 충분히 씻는 것이 식품 위생의 기본입니다.',2),
('food','fridge','냉장고 온도','냉장고는 차갑게 유지하고 식품을 지나치게 꽉 채우지 않아야 냉기가 고르게 순환합니다.',3),
('food','knife','칼 안전','칼이 떨어질 때 손으로 잡으려 하지 말고 뒤로 물러나는 것이 안전합니다.',4),
('food','salt_later','간 맞추기','국물 요리는 조리 후반에 간을 확인하면 졸아들며 지나치게 짜지는 것을 줄일 수 있습니다.',5),
('food','rest_meat','고기 레스팅','구운 고기를 잠시 쉬게 하면 내부의 육즙이 고르게 자리 잡는 데 도움이 됩니다.',6),
('food','vegetable_order','채소 손질 순서','채소는 흐르는 물에 씻은 뒤 필요한 크기로 자르면 오염이 안쪽으로 번지는 것을 줄일 수 있습니다.',7),
('food','freezer_label','냉동 보관 표시','냉동 용기에 식품명과 보관 날짜를 적으면 오래된 식품부터 사용하기 쉽습니다.',8),
('food','taste_balance','맛의 균형','짠맛이 강할 때 단맛만 더하기보다 재료와 물의 양을 늘려 전체 농도를 조절하는 편이 안정적입니다.',9),
('food','leftovers','남은 음식 보관','남은 음식은 실온에 오래 두지 말고 적절히 식혀 밀폐한 뒤 냉장 보관해야 합니다.',10),
('home','ventilation','환기','짧게라도 맞통풍이 되도록 창문을 열면 실내 공기를 효율적으로 바꾸는 데 도움이 됩니다.',1),
('home','clean_order','청소 순서','먼지는 위에서 아래로 떨어지므로 높은 곳부터 낮은 곳 순서로 청소하는 것이 효율적입니다.',2),
('home','mold','곰팡이 예방','습기가 오래 머물지 않도록 환기하고 물기를 바로 닦는 것이 곰팡이 예방의 기본입니다.',3),
('home','power_strip','멀티탭 안전','멀티탭의 정격 용량을 넘겨 여러 고전력 제품을 동시에 사용하면 과열 위험이 있습니다.',4),
('home','storage','수납 원칙','자주 쓰는 물건을 손이 쉽게 닿는 위치에 두면 정리 상태를 유지하기 쉬워집니다.',5),
('home','detergent_mix','세제 혼합 금지','염소계 표백제를 다른 세제와 임의로 섞으면 위험한 기체가 생길 수 있어 피해야 합니다.',6),
('home','fridge_gap','냉장고 뒤 공간','냉장고 뒤쪽에 방열 공간을 확보하면 열이 빠져나가고 효율을 유지하는 데 도움이 됩니다.',7),
('home','laundry_label','세탁 라벨','의류의 세탁 라벨을 확인하면 수축과 변형을 줄일 수 있습니다.',8),
('home','drain','배수구 관리','배수구의 이물질을 자주 제거하면 악취와 막힘을 예방하는 데 도움이 됩니다.',9),
('home','emergency','비상용품','손전등과 보조배터리 같은 비상용품은 한곳에 모으고 정기적으로 상태를 확인하는 것이 좋습니다.',10),
('hobby','small_start','취미 시작','새 취미는 필요한 최소 도구로 먼저 경험해 본 뒤 장비를 늘리는 편이 불필요한 지출을 줄입니다.',1),
('hobby','collection_log','수집 기록','수집품의 구입 날짜와 상태를 기록하면 중복 구매와 관리 누락을 줄일 수 있습니다.',2),
('hobby','light_damage','빛과 보관','종이와 섬유 수집품은 강한 햇빛에 오래 노출되면 색이 바랠 수 있습니다.',3),
('hobby','humidity','습도 관리','금속과 종이 수집품은 지나치게 습한 환경을 피해야 손상을 줄일 수 있습니다.',4),
('hobby','practice','연습 습관','긴 시간 한 번보다 짧은 시간을 꾸준히 반복하는 편이 기술을 익히는 데 효과적입니다.',5),
('hobby','community','취미 공동체','취미 공동체에서는 작품과 장비를 존중하고 촬영이나 공유 전 허락을 구하는 것이 좋습니다.',6),
('hobby','backup','작품 백업','디지털 작품은 원본과 별도로 백업본을 보관해야 예기치 않은 손실에 대비할 수 있습니다.',7),
('hobby','budget','취미 예산','월별 취미 예산을 정하면 즐거움을 유지하면서 과소비를 줄일 수 있습니다.',8),
('hobby','ergonomics','작업 자세','반복 작업을 하는 취미는 중간중간 손목과 눈을 쉬게 해야 부담을 줄일 수 있습니다.',9),
('hobby','catalog','소장품 분류','소장품에 분류 기준과 번호를 부여하면 원하는 물건을 빠르게 찾을 수 있습니다.',10),
('travel','copy_docs','서류 사본','여행 서류의 사본을 원본과 다른 곳에 보관하면 분실 상황에 대비하기 좋습니다.',1),
('travel','local_time','현지 시간','항공편과 예약 시간은 출발지와 도착지의 현지 시간을 구분해 확인해야 합니다.',2),
('travel','insurance','여행자 보험','여행자 보험은 보장 범위와 제외 항목을 확인한 뒤 여행 형태에 맞게 선택해야 합니다.',3),
('travel','weather','날씨 확인','출발 직전 현지 날씨와 기상 특보를 확인하면 일정과 준비물을 조정하기 쉽습니다.',4),
('travel','offline_map','오프라인 지도','통신이 불안정한 지역을 여행할 때는 오프라인 지도를 미리 저장하면 도움이 됩니다.',5),
('travel','buffer','이동 여유 시간','환승과 예약 일정 사이에 여유 시간을 두면 지연 상황에 대응하기 쉽습니다.',6),
('travel','respect','현지 문화 존중','복장과 촬영 등 현지 규칙을 미리 확인하고 존중하는 것이 책임 있는 여행의 기본입니다.',7),
('travel','light_pack','가벼운 짐','사용 장면이 겹치는 물건을 줄이고 목록을 만들면 짐을 가볍게 꾸리기 쉽습니다.',8),
('travel','emergency_contact','비상 연락처','숙소와 현지 긴급 연락처를 따로 기록해 두면 휴대전화 사용이 어려울 때 도움이 됩니다.',9),
('travel','water','여행 중 수분','이동이 긴 날에는 물을 조금씩 자주 마시며 컨디션을 관리하는 것이 좋습니다.',10),
('wellness','warmup','준비운동','운동 전에는 낮은 강도의 움직임으로 몸을 서서히 준비시키는 것이 좋습니다.',1),
('wellness','progressive','점진적 증가','운동 강도와 시간을 갑자기 크게 늘리기보다 조금씩 높이는 편이 부담을 줄입니다.',2),
('wellness','sleep_routine','수면 루틴','비슷한 시간에 잠들고 일어나는 습관은 생활 리듬을 일정하게 유지하는 데 도움이 됩니다.',3),
('wellness','hydration','수분 보충','갈증과 활동량을 살피며 물을 나누어 마시는 것이 좋습니다.',4),
('wellness','rest','회복일','운동 계획에는 휴식과 회복 시간도 포함되어야 꾸준히 이어가기 쉽습니다.',5),
('wellness','posture','자세 바꾸기','같은 자세로 오래 있기보다 주기적으로 일어나 움직이면 몸의 부담을 줄일 수 있습니다.',6),
('wellness','habit_trigger','습관 신호','새 습관을 기존 행동 직후에 연결하면 기억하고 반복하기 쉬워집니다.',7),
('wellness','realistic_goal','현실적인 목표','측정 가능하고 작은 목표부터 시작하면 성취를 확인하며 지속하기 좋습니다.',8),
('wellness','pain','통증 신호','운동 중 날카롭거나 심한 통증이 느껴지면 무리해서 계속하지 말아야 합니다.',9),
('wellness','record','생활 기록','수면과 활동을 간단히 기록하면 자신의 패턴을 파악하는 데 도움이 됩니다.',10),
('family','routine','가족 루틴','예측 가능한 일과는 아이가 다음 활동을 이해하고 준비하는 데 도움을 줄 수 있습니다.',1),
('family','listen','감정 듣기','아이의 감정을 먼저 듣고 이름 붙여 주면 자신의 마음을 이해하는 데 도움이 됩니다.',2),
('family','choice','제한된 선택지','가능한 두세 가지 선택지를 제시하면 경계를 유지하면서 자율성을 도울 수 있습니다.',3),
('family','medicine','약 보관','가정의 약은 아이의 손이 닿지 않고 잠금이 가능한 장소에 보관해야 합니다.',4),
('family','car_seat','카시트','아이의 연령과 체격에 맞는 카시트를 설명서대로 설치하고 사용하는 것이 중요합니다.',5),
('family','praise','구체적인 칭찬','결과만보다 노력과 구체적인 행동을 짚어 칭찬하면 무엇을 잘했는지 알기 쉽습니다.',6),
('family','screen','화면 사용 약속','가족이 함께 화면 사용 시간과 장소의 기준을 정하면 일관성을 유지하기 쉽습니다.',7),
('family','emergency','가족 비상계획','비상시 연락할 사람과 만날 장소를 가족이 함께 정해 두는 것이 좋습니다.',8),
('family','play','놀이의 역할','자유 놀이는 아이가 상상하고 문제를 해결하는 경험을 쌓는 데 도움이 됩니다.',9),
('family','model','보호자의 본보기','아이에게 기대하는 행동을 보호자가 먼저 보여주는 것이 효과적인 학습 방법이 될 수 있습니다.',10),
('mobility','tire','타이어 공기압','타이어 공기압은 차량 제조사가 안내한 기준을 바탕으로 정기적으로 확인해야 합니다.',1),
('mobility','warning','경고등','주행 중 새로운 경고등이 켜지면 의미를 확인하고 필요한 점검을 받아야 합니다.',2),
('mobility','seatbelt','안전벨트','짧은 거리라도 모든 탑승자가 안전벨트를 착용해야 합니다.',3),
('mobility','blind_spot','사각지대','차선 변경 전 거울뿐 아니라 고개를 돌려 사각지대를 확인하는 것이 중요합니다.',4),
('mobility','distance','안전거리','앞차와 충분한 거리를 두면 갑작스러운 상황에 대응할 시간을 확보할 수 있습니다.',5),
('mobility','wiper','와이퍼 관리','와이퍼가 줄무늬를 남기거나 소음을 내면 상태를 확인하고 교체를 고려해야 합니다.',6),
('mobility','battery','배터리','시동이 평소보다 약하거나 전기장치가 불안정하면 배터리 상태를 점검할 필요가 있습니다.',7),
('mobility','eco','급가속 줄이기','급가속과 급제동을 줄이는 운전은 연료 소비와 차량 부담을 줄이는 데 도움이 됩니다.',8),
('mobility','pedestrian','보행자 우선','횡단보도 주변에서는 속도를 줄이고 보행자의 움직임을 먼저 확인해야 합니다.',9),
('mobility','maintenance_log','정비 기록','소모품 교체 시기와 정비 내용을 기록하면 차량 상태를 체계적으로 관리하기 쉽습니다.',10),
('style','patch_test','패치 테스트','새 화장품은 좁은 부위에 먼저 시험해 피부 반응을 살펴보는 것이 좋습니다.',1),
('style','sunscreen','자외선 차단','자외선 차단제는 야외 활동 시간과 제품 안내에 맞춰 충분히 사용해야 합니다.',2),
('style','clean_tools','도구 세척','메이크업 브러시와 퍼프를 정기적으로 세척하면 오염 축적을 줄일 수 있습니다.',3),
('style','fabric','소재 확인','옷을 구매할 때 소재와 세탁 방법을 함께 확인하면 관리 실패를 줄일 수 있습니다.',4),
('style','fit','옷의 핏','표기된 치수만 보지 말고 자신의 실측과 제품 실측을 비교하는 것이 정확합니다.',5),
('style','wardrobe','옷장 목록','가지고 있는 옷을 확인한 뒤 구매하면 비슷한 제품의 중복을 줄일 수 있습니다.',6),
('style','skin_change','피부 변화','피부 상태가 달라졌을 때는 여러 제품을 한꺼번에 바꾸기보다 하나씩 조정하는 편이 원인을 찾기 쉽습니다.',7),
('style','fragrance','향 제품 사용','향이 강한 제품은 주변 사람과 공간을 고려해 적정량을 사용하는 것이 좋습니다.',8),
('style','shoe','신발 선택','신발은 길이뿐 아니라 발볼과 활동 목적을 함께 고려해야 편안합니다.',9),
('style','timeless','기본 아이템','자주 입는 색과 형태의 기본 아이템은 기존 옷과 조합하기 쉽습니다.',10),
('learning','retrieval','인출 연습','내용을 다시 읽기만 하는 것보다 기억에서 꺼내 답해 보는 연습이 이해 점검에 도움이 됩니다.',1),
('learning','spaced','분산 학습','한 번에 몰아서 공부하기보다 시간을 두고 반복하면 기억을 유지하는 데 도움이 됩니다.',2),
('learning','goal','학습 목표','공부 시간을 정하는 것과 함께 무엇을 끝낼지 구체적으로 정하는 것이 좋습니다.',3),
('learning','mistake','오답 기록','틀린 이유와 올바른 접근을 함께 기록하면 같은 실수를 줄이는 데 도움이 됩니다.',4),
('learning','break','짧은 휴식','집중 학습 사이에 짧은 휴식을 두면 피로를 관리하기 쉽습니다.',5),
('learning','explain','설명하기','배운 내용을 자신의 말로 설명해 보면 이해가 부족한 부분을 발견할 수 있습니다.',6),
('learning','environment','학습 환경','공부를 시작하기 어렵다면 필요한 도구를 미리 꺼내 두고 방해 요소를 줄이는 것이 좋습니다.',7),
('learning','review','복습 시점','학습 직후와 시간이 지난 뒤 다시 확인하면 잊은 부분을 보완하기 쉽습니다.',8),
('learning','question','질문 만들기','학습 내용으로 스스로 질문을 만들면 핵심 개념을 능동적으로 살펴볼 수 있습니다.',9),
('learning','sleep','수면과 학습','충분한 수면은 학습한 내용을 정리하고 다음 날 집중하는 데 중요합니다.',10),
('local','noise','생활 소음','늦은 시간에는 공동주택과 이웃을 고려해 소음을 줄이는 것이 기본 예절입니다.',1),
('local','waste','분리배출','분리배출 기준은 지역마다 다를 수 있어 거주 지역의 안내를 확인해야 합니다.',2),
('local','event','지역 행사','지역 행사의 일정과 변경 사항은 지자체나 공식 주최 측 안내에서 확인하는 것이 정확합니다.',3),
('local','safety','밤길 안전','늦은 시간에는 밝고 사람의 왕래가 있는 길을 선택하는 편이 안전합니다.',4),
('local','report','시설 신고','고장 난 가로등이나 위험 시설은 위치를 정확히 기록해 관할 기관에 알리면 처리에 도움이 됩니다.',5),
('local','market','지역 상점','동네 상점을 이용하고 정확한 후기를 남기면 지역 생활 정보가 풍부해집니다.',6),
('local','parking','주차 배려','출입구와 소방 시설 주변을 막지 않는 것은 이웃의 안전과 이동을 위한 기본입니다.',7),
('local','pet','공공장소 반려 예절','공공장소에서는 반려동물의 배설물을 처리하고 다른 이용자와 거리를 배려해야 합니다.',8),
('local','lost','분실물','분실물을 발견하면 임의로 사용하지 말고 시설 관리자나 관할 기관에 맡기는 것이 좋습니다.',9),
('local','map','장소 공유','장소를 추천할 때 운영 시간과 위치 정보의 최신 여부를 함께 확인하면 도움이 됩니다.',10),
('culture','spoiler','스포일러 배려','작품의 핵심 내용을 공유할 때는 먼저 스포일러가 있음을 알리는 것이 좋습니다.',1),
('culture','source','창작물 출처','창작물을 공유할 때는 원작자와 출처를 확인하고 이용 조건을 지켜야 합니다.',2),
('culture','review','감상 후기','사실 정보와 개인적인 감상을 구분해 쓰면 독자가 내용을 이해하기 쉽습니다.',3),
('culture','rating','관람 등급','영상물과 게임의 이용 등급은 연령에 맞는 콘텐츠 선택을 돕는 기준입니다.',4),
('culture','ticket','공연 예매','공연 예매 전 날짜와 장소, 취소 및 환불 규정을 확인해야 합니다.',5),
('culture','library','도서관 예절','도서관 자료는 정해진 기한 안에 반납하고 훼손되지 않도록 다뤄야 합니다.',6),
('culture','interpretation','다양한 해석','같은 작품도 경험과 관점에 따라 다르게 해석할 수 있음을 존중하는 것이 좋습니다.',7),
('culture','archive','감상 기록','본 날짜와 인상 깊은 점을 짧게 기록하면 나만의 취향을 파악하는 데 도움이 됩니다.',8),
('culture','official','공식 경로','창작물을 정식 경로로 이용하는 것은 창작 생태계를 지속하는 데 도움이 됩니다.',9),
('culture','recommend','작품 추천','상대의 취향과 피하고 싶은 요소를 먼저 물으면 더 알맞은 작품을 추천할 수 있습니다.',10),
('society','primary_source','1차 자료','주장이나 통계를 확인할 때 원문 보고서와 공식 자료를 찾아보는 것이 중요합니다.',1),
('society','date','정보의 날짜','사회 이슈는 상황이 빠르게 바뀔 수 있어 게시 날짜와 기준 시점을 확인해야 합니다.',2),
('society','fact_opinion','사실과 의견','검증 가능한 사실과 개인의 해석이나 의견을 구분해서 읽는 것이 좋습니다.',3),
('society','multiple','복수 출처','하나의 출처에만 의존하지 않고 서로 다른 신뢰할 만한 자료를 비교해야 합니다.',4),
('society','graph','그래프 읽기','그래프는 축의 범위와 단위에 따라 인상이 달라질 수 있어 함께 확인해야 합니다.',5),
('society','sample','표본','조사 결과를 볼 때 조사 대상의 수와 선정 방식이 전체를 대표하는지 살펴봐야 합니다.',6),
('society','headline','제목과 본문','강한 제목만 보고 판단하지 말고 본문과 근거를 확인하는 것이 중요합니다.',7),
('society','correction','정정 보도','잘못된 정보가 정정되었는지 후속 보도와 수정 내역을 확인하는 습관이 필요합니다.',8),
('society','privacy','개인정보 보호','공익적 관심이 있더라도 개인의 연락처와 사적 정보를 함부로 공유하면 안 됩니다.',9),
('society','dialogue','의견 대화','의견이 다를 때는 사람을 공격하기보다 주장과 근거를 중심으로 대화하는 것이 좋습니다.',10),
('ai-tech','password','비밀번호','서비스마다 서로 다른 긴 비밀번호를 사용하면 한 곳의 유출이 다른 계정으로 번지는 위험을 줄입니다.',1),
('ai-tech','two_factor','2단계 인증','2단계 인증은 비밀번호가 노출되어도 추가 확인 절차로 계정을 보호하는 데 도움을 줍니다.',2),
('ai-tech','backup','데이터 백업','중요한 데이터는 원본과 분리된 위치에 백업해야 기기 고장과 손실에 대비할 수 있습니다.',3),
('ai-tech','update','보안 업데이트','운영체제와 앱의 보안 업데이트를 적용하면 알려진 취약점 위험을 줄일 수 있습니다.',4),
('ai-tech','phishing','피싱 확인','급하게 링크 클릭이나 정보 입력을 요구하는 메시지는 발신자와 주소를 별도로 확인해야 합니다.',5),
('ai-tech','ai_verify','AI 답변 검증','AI가 생성한 답변도 틀릴 수 있으므로 중요한 정보는 신뢰할 수 있는 원문으로 확인해야 합니다.',6),
('ai-tech','permission','앱 권한','앱이 요구하는 카메라와 위치 권한이 기능에 꼭 필요한지 확인하고 불필요한 권한은 끄는 것이 좋습니다.',7),
('ai-tech','public_wifi','공용 와이파이','공용 와이파이에서는 민감한 정보 입력과 중요한 거래를 피하는 편이 안전합니다.',8),
('ai-tech','file_extension','파일 확장자','출처가 불분명한 실행 파일과 첨부파일은 열기 전에 유형과 발신자를 확인해야 합니다.',9),
('ai-tech','privacy_ai','AI와 개인정보','AI 서비스에 주민번호나 비밀번호 같은 민감한 개인정보를 입력하지 않아야 합니다.',10),
('finance','emergency_fund','비상자금','예상하지 못한 지출에 대비한 비상자금은 일상 계좌와 구분해 두는 것이 관리에 도움이 됩니다.',1),
('finance','compound','복리','복리는 원금뿐 아니라 이전에 붙은 수익에도 다시 수익이 붙는 구조입니다.',2),
('finance','diversify','분산','여러 자산에 나누어 투자하는 것은 특정 자산의 위험에 지나치게 노출되는 것을 줄이는 방법입니다.',3),
('finance','fee','수수료','금융상품은 기대수익뿐 아니라 수수료와 세금이 실제 결과에 미치는 영향도 확인해야 합니다.',4),
('finance','budget','예산','고정비와 변동비를 구분해 기록하면 조정할 수 있는 지출을 찾기 쉽습니다.',5),
('finance','interest','금리 비교','대출은 표시 금리뿐 아니라 상환 방식과 총 상환액을 함께 비교해야 합니다.',6),
('finance','risk_return','위험과 수익','일반적으로 높은 기대수익에는 더 큰 손실 가능성이 따를 수 있습니다.',7),
('finance','scam','투자 사기 경계','원금 보장과 고수익을 동시에 확정적으로 약속하며 입금을 재촉하면 신중히 확인해야 합니다.',8),
('finance','credit','신용 관리','납부 기한을 지키고 감당 가능한 범위에서 부채를 관리하는 것이 중요합니다.',9),
('finance','goal','목표별 자금','사용 시점과 목적에 따라 단기 자금과 장기 자금의 관리 방법을 구분하는 것이 좋습니다.',10),
('career','priority','업무 우선순위','중요도와 마감 시점을 함께 고려하면 업무 우선순위를 정하기 쉽습니다.',1),
('career','record','업무 기록','결정 사항과 담당자, 기한을 기록하면 협업 중 누락을 줄일 수 있습니다.',2),
('career','feedback','피드백','피드백은 사람의 성격보다 관찰한 행동과 그 영향, 개선 방향을 중심으로 전달하는 것이 좋습니다.',3),
('career','meeting','회의 준비','회의 목적과 논의할 내용을 미리 공유하면 필요한 사람이 준비하기 쉽습니다.',4),
('career','handover','업무 인수인계','인수인계에는 현재 상태와 다음 할 일, 참고 자료의 위치가 포함되어야 합니다.',5),
('career','focus','집중 시간','알림을 줄이고 비슷한 업무를 묶어 처리하면 작업 전환에 드는 시간을 줄일 수 있습니다.',6),
('career','boundary','업무 경계','업무량이 감당하기 어렵다면 우선순위와 기한을 담당자와 구체적으로 조율하는 것이 좋습니다.',7),
('career','resume','경력 기술','경력은 맡은 일만 나열하기보다 문제와 행동, 결과를 구체적으로 설명하는 것이 좋습니다.',8),
('career','learning','역량 개발','현재 업무에 필요한 역량과 앞으로 원하는 역할의 차이를 파악하면 학습 계획을 세우기 쉽습니다.',9),
('career','network','직장 내 관계','도움을 받았을 때 결과를 공유하고 감사를 표현하면 건강한 협업 관계를 만드는 데 도움이 됩니다.',10)
ON CONFLICT(category_code,concept_key) DO UPDATE SET term=EXCLUDED.term,fact=EXCLUDED.fact,sort_order=EXCLUDED.sort_order;

WITH numbered AS (
  SELECT concepts.*,
    array_agg(fact) OVER(PARTITION BY category_code ORDER BY sort_order ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS facts
  FROM mission_question_concepts concepts
), expanded AS (
  SELECT numbered.*,variant_no,
    ((sort_order+variant_no-2)%4)::smallint AS correct_index,
    facts[((sort_order)%10)+1] AS wrong1,
    facts[((sort_order+1)%10)+1] AS wrong2,
    facts[((sort_order+2)%10)+1] AS wrong3
  FROM numbered CROSS JOIN generate_series(1,20) AS variant_no
), prepared AS (
  SELECT *,CASE variant_no
    WHEN 1 THEN format('다음 중 %s에 대한 설명으로 가장 알맞은 것은 무엇일까요?',term)
    WHEN 2 THEN format('%s를 올바르게 이해한 내용을 골라보세요.',term)
    WHEN 3 THEN format('%s에 관해 정확하게 설명한 선택지는 무엇인가요?',term)
    WHEN 4 THEN format('생활 속 %s에 대한 바른 정보를 찾아보세요.',term)
    WHEN 5 THEN format('%s와 관련해 기억해 둘 내용은 무엇일까요?',term)
    WHEN 6 THEN format('%s에 대한 설명 중 사실에 가까운 것은 무엇인가요?',term)
    WHEN 7 THEN format('%s를 실천하거나 이해하는 방법으로 알맞은 것은?',term)
    WHEN 8 THEN format('다음 보기에서 %s의 핵심 내용을 골라보세요.',term)
    WHEN 9 THEN format('%s에 관해 다른 사람에게 알려줄 내용으로 적절한 것은?',term)
    WHEN 10 THEN format('%s에 대한 생활 상식으로 옳은 것은 무엇일까요?',term)
    WHEN 11 THEN format('오늘의 %s 미션입니다. 가장 정확한 설명을 골라보세요.',term)
    WHEN 12 THEN format('%s에 대해 잘못 알고 있지 않은 선택지는 무엇인가요?',term)
    WHEN 13 THEN format('%s의 의미를 가장 잘 담은 설명을 찾아보세요.',term)
    WHEN 14 THEN format('일상에서 %s를 떠올릴 때 기억할 점은 무엇일까요?',term)
    WHEN 15 THEN format('%s에 대한 네 가지 설명 중 알맞은 하나를 골라보세요.',term)
    WHEN 16 THEN format('%s와 관련한 안전하고 적절한 행동은 무엇인가요?',term)
    WHEN 17 THEN format('%s를 주제로 한 퀴즈입니다. 맞는 설명은 무엇일까요?',term)
    WHEN 18 THEN format('%s에 대한 핵심 원칙으로 가장 알맞은 것은?',term)
    WHEN 19 THEN format('다음 중 %s를 정확히 설명하는 문장은 무엇인가요?',term)
    ELSE format('%s에 관해 오늘 기억해 둘 한 가지를 골라보세요.',term) END AS generated_question
  FROM expanded
)
INSERT INTO mission_question_bank(category_code,concept_key,variant_no,question,options,correct_index,explanation)
SELECT category_code,concept_key,variant_no,generated_question,
  CASE correct_index
    WHEN 0 THEN jsonb_build_array(fact,wrong1,wrong2,wrong3)
    WHEN 1 THEN jsonb_build_array(wrong1,fact,wrong2,wrong3)
    WHEN 2 THEN jsonb_build_array(wrong1,wrong2,fact,wrong3)
    ELSE jsonb_build_array(wrong1,wrong2,wrong3,fact) END,
  correct_index,format('%s: %s',term,fact)
FROM prepared
ON CONFLICT(category_code,concept_key,variant_no) DO UPDATE SET question=EXCLUDED.question,options=EXCLUDED.options,correct_index=EXCLUDED.correct_index,explanation=EXCLUDED.explanation,enabled=true;

-- 등급별 가격 간격을 분명히 하고, 상위 등급은 하위 등급 전체 수집 후 해금합니다.
WITH ranked AS (
  SELECT code,rarity,row_number() OVER(PARTITION BY rarity ORDER BY sort_order) AS rn
  FROM attendance_stamp_catalog WHERE price>0
)
UPDATE attendance_stamp_catalog catalog SET price=CASE ranked.rarity
  WHEN 'common' THEN 10+(ranked.rn-1)*5
  WHEN 'uncommon' THEN 80+(ranked.rn-1)*15
  WHEN 'rare' THEN 250+(ranked.rn-1)*30
  WHEN 'epic' THEN 600+(ranked.rn-1)*75
  WHEN 'legendary' THEN 1500+(ranked.rn-1)*250
  WHEN 'mythic' THEN 3000+(ranked.rn-1)*1000
  ELSE catalog.price END
FROM ranked WHERE catalog.code=ranked.code;

COMMIT;
