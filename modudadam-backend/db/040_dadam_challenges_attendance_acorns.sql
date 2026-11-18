BEGIN;

CREATE TABLE IF NOT EXISTS acorn_wallets (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned integer NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  lifetime_spent integer NOT NULL DEFAULT 0 CHECK (lifetime_spent >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acorn_transactions (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  transaction_type varchar(30) NOT NULL CHECK (transaction_type IN ('attendance','attendance_bonus','challenge_checkin','challenge_complete','stamp_purchase')),
  reference_id varchar(100),
  description varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acorn_transactions_user_idx ON acorn_transactions(user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS attendance_stamp_catalog (
  code varchar(30) PRIMARY KEY,
  name varchar(40) NOT NULL,
  emoji varchar(16) NOT NULL,
  description varchar(120) NOT NULL,
  price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
  sort_order smallint NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS user_attendance_stamps (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stamp_code varchar(30) NOT NULL REFERENCES attendance_stamp_catalog(code),
  equipped boolean NOT NULL DEFAULT false,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,stamp_code)
);
CREATE UNIQUE INDEX IF NOT EXISTS user_attendance_stamps_equipped_idx ON user_attendance_stamps(user_id) WHERE equipped;

CREATE TABLE IF NOT EXISTS attendance_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_on date NOT NULL,
  stamp_code varchar(30) NOT NULL REFERENCES attendance_stamp_catalog(code),
  acorns_earned integer NOT NULL CHECK (acorns_earned > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,attendance_on)
);
CREATE INDEX IF NOT EXISTS attendance_checkins_user_idx ON attendance_checkins(user_id,attendance_on DESC);

CREATE TABLE IF NOT EXISTS dadam_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(60) NOT NULL UNIQUE,
  title varchar(80) NOT NULL,
  description varchar(300) NOT NULL,
  icon varchar(16) NOT NULL,
  category_name varchar(40) NOT NULL,
  goal_days smallint NOT NULL CHECK (goal_days BETWEEN 2 AND 60),
  period_days smallint NOT NULL CHECK (period_days >= goal_days AND period_days <= 90),
  daily_acorns smallint NOT NULL DEFAULT 1 CHECK (daily_acorns BETWEEN 0 AND 10),
  completion_acorns smallint NOT NULL DEFAULT 5 CHECK (completion_acorns BETWEEN 0 AND 100),
  status varchar(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','closed')),
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS challenge_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES dadam_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_on date NOT NULL,
  ends_on date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired')),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id,user_id)
);
CREATE INDEX IF NOT EXISTS challenge_enrollments_user_idx ON challenge_enrollments(user_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS challenge_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES challenge_enrollments(id) ON DELETE CASCADE,
  checkin_on date NOT NULL,
  note varchar(160),
  acorns_earned integer NOT NULL CHECK (acorns_earned >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(enrollment_id,checkin_on)
);

INSERT INTO attendance_stamp_catalog(code,name,emoji,description,price,sort_order) VALUES
  ('basic','첫 발자국','🐾','모두다담 출석부의 기본 스탬프',0,1),
  ('acorn','도토리 한 알','🌰','차곡차곡 모으는 즐거움',8,2),
  ('clover','행운의 클로버','🍀','기분 좋은 하루를 남기는 스탬프',12,3),
  ('sun','포근한 햇살','☀️','따뜻하게 빛난 하루의 기록',15,4),
  ('moon','고요한 달빛','🌙','차분하게 하루를 마친 기록',15,5),
  ('flower','다정한 꽃','🌼','마음이 피어난 날의 기록',20,6),
  ('squirrel','다담 다람쥐','🐿️','도토리를 사랑하는 수집가의 스탬프',30,7),
  ('rainbow','무지개','🌈','꾸준함 끝에 만난 특별한 기록',45,8)
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,emoji=EXCLUDED.emoji,description=EXCLUDED.description,price=EXCLUDED.price,sort_order=EXCLUDED.sort_order;

INSERT INTO dadam_challenges(slug,title,description,icon,category_name,goal_days,period_days,daily_acorns,completion_acorns,sort_order) VALUES
  ('ten-minute-walk','하루 10분 산책','멀리 가지 않아도 좋아요. 하루 10분, 가볍게 걸어보세요.','🚶','운동·습관',7,10,1,5,1),
  ('one-more-water','물 한 잔 더 마시기','평소보다 물 한 잔을 더 마시며 작은 건강 습관을 만들어요.','💧','운동·습관',7,10,1,5,2),
  ('empty-fridge','냉장고 한 칸 비우기','집에 있는 재료를 한 번 더 살펴보고 알뜰한 한 끼를 만들어요.','🥗','음식·요리',5,14,1,5,3),
  ('happy-pet-time','반려동물과 온전히 놀기','휴대폰을 잠시 내려놓고 반려동물에게 집중하는 시간을 가져요.','🐾','동물·반려동물',7,10,1,6,4),
  ('one-page-day','하루 한 페이지 읽기','분량보다 꾸준함에 집중하며 매일 한 페이지를 읽어요.','📖','학습',14,21,1,10,5),
  ('ten-minute-tidy','잠들기 전 10분 정리','내일의 나를 위해 한 공간만 가볍게 정돈해요.','🧺','집·살림',7,10,1,5,6)
ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,icon=EXCLUDED.icon,category_name=EXCLUDED.category_name,goal_days=EXCLUDED.goal_days,period_days=EXCLUDED.period_days,daily_acorns=EXCLUDED.daily_acorns,completion_acorns=EXCLUDED.completion_acorns,sort_order=EXCLUDED.sort_order;

COMMIT;
