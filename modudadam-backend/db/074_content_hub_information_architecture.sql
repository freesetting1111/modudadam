BEGIN;

-- 콘텐츠 허브의 노출 순서와 문구를 배포 없이 조정할 수 있도록 분리합니다.
CREATE TABLE IF NOT EXISTS content_hub_groups (
  code varchar(30) PRIMARY KEY,
  title varchar(40) NOT NULL,
  description varchar(120) NOT NULL DEFAULT '',
  icon varchar(40) NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_hub_items (
  code varchar(40) PRIMARY KEY,
  group_code varchar(30) NOT NULL REFERENCES content_hub_groups(code) ON UPDATE CASCADE,
  href varchar(200) NOT NULL UNIQUE CHECK (href LIKE '/play/%'),
  title varchar(60) NOT NULL,
  label varchar(40) NOT NULL DEFAULT '',
  description varchar(160) NOT NULL DEFAULT '',
  icon varchar(40) NOT NULL,
  tone varchar(20) NOT NULL CHECK (tone IN ('blue','coral','amber','green','purple')),
  sort_order smallint NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_hub_items_group_order_idx
  ON content_hub_items(group_code,sort_order,code) WHERE enabled;

INSERT INTO content_hub_groups(code,title,description,icon,sort_order,enabled) VALUES
  ('daily','오늘 할 일','매일 새로 열리는 콘텐츠','sparkles',10,true),
  ('connect','사람들과 나누기','사연, 선물과 장소','heart-handshake',20,true),
  ('grow','나를 쌓기','습관, 기록과 취향','notebook-tabs',30,true),
  ('explore','둘러보기','새 글 발견과 보상 관리','compass',40,true)
ON CONFLICT(code) DO UPDATE SET
  title=EXCLUDED.title,description=EXCLUDED.description,icon=EXCLUDED.icon,
  sort_order=EXCLUDED.sort_order,enabled=EXCLUDED.enabled,updated_at=now();

INSERT INTO content_hub_items(code,group_code,href,title,label,description,icon,tone,sort_order,enabled) VALUES
  ('attendance','daily','/play/attendance','다담 출석부','하루 한 번','오늘 출석을 기록해요.','calendar-check','green',10,true),
  ('choice','daily','/play/choice','극한 밸런스','오늘의 선택','두 선택 중 하나를 골라요.','vote','coral',20,true),
  ('detective','daily','/play/detective','다담 추리방','오늘의 사건','단서를 확인하고 정답을 찾아요.','shield-question','blue',30,true),
  ('missions','daily','/play/missions','다담 미션','생활 퀴즈','주제를 골라 세 문제를 풀어요.','trophy','amber',40,true),
  ('bounty','connect','/play/bounties','현상금 질문','답변 요청','도토리를 걸고 경험 있는 답변을 요청해요.','hand-coins','amber',5,true),
  ('mailbox','connect','/play/mailbox','다담 우체통','익명','사연을 보내고 답장을 나눠요.','mail','blue',10,true),
  ('acorn-gift','connect','/play/acorn-gift','도토리 선물','선물','다른 사용자에게 도토리를 보내요.','hand-coins','amber',20,true),
  ('treasures','connect','/play/treasures','동네 보물지도','장소','이웃이 등록한 장소를 찾아요.','map-pin','green',30,true),
  ('challenges','grow','/play/challenges','다담 챌린지','습관','목표를 정하고 매일 인증해요.','target','coral',10,true),
  ('time-capsule','grow','/play/time-capsule','다담 타임캡슐','예약 편지','정한 날짜까지 편지를 보관해요.','hourglass','purple',20,true),
  ('taste','grow','/play/taste','취향 발견실','10문항','생활 취향을 확인해요.','sparkles','purple',30,true),
  ('random','explore','/play/random','랜덤 이야기','무작위 게시글','게시글 하나를 무작위로 보여드려요.','compass','amber',10,true),
  ('stamps','explore','/play/stamps','도토리 상점','보상 관리','스탬프 구매와 포인트 전환','store','purple',20,true)
ON CONFLICT(code) DO UPDATE SET
  group_code=EXCLUDED.group_code,href=EXCLUDED.href,title=EXCLUDED.title,
  label=EXCLUDED.label,description=EXCLUDED.description,icon=EXCLUDED.icon,
  tone=EXCLUDED.tone,sort_order=EXCLUDED.sort_order,enabled=EXCLUDED.enabled,updated_at=now();

-- 허브에서 실제로 선택된 메뉴를 기록해 이후 노출 순서를 검증합니다.
CREATE TABLE IF NOT EXISTS content_hub_interactions (
  id bigserial PRIMARY KEY,
  item_code varchar(40) NOT NULL REFERENCES content_hub_items(code) ON UPDATE CASCADE,
  placement varchar(30) NOT NULL CHECK (placement IN ('primary','daily','group','quick_nav')),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  visitor_key varchar(100),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_hub_interactions_item_time_idx
  ON content_hub_interactions(item_code,occurred_at DESC);
CREATE INDEX IF NOT EXISTS content_hub_interactions_user_time_idx
  ON content_hub_interactions(user_id,occurred_at DESC) WHERE user_id IS NOT NULL;

CREATE OR REPLACE VIEW content_hub_daily_metrics AS
SELECT
  (occurred_at AT TIME ZONE 'Asia/Seoul')::date AS metric_on,
  item_code,
  placement,
  count(*)::bigint AS clicks,
  count(DISTINCT COALESCE(user_id::text,visitor_key))::bigint AS visitors
FROM content_hub_interactions
GROUP BY (occurred_at AT TIME ZONE 'Asia/Seoul')::date,item_code,placement;

COMMIT;
