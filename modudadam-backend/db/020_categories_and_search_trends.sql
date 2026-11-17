BEGIN;

INSERT INTO categories(code,name,icon,description,sort_order,is_active) VALUES
  ('society','사회·이슈','landmark','사회 현상, 정책, 뉴스와 다양한 관점',13,true),
  ('ai-tech','AI·기술','bot','인공지능, 디지털 기술, 서비스와 활용 경험',14,true),
  ('finance','경제·재테크','chart','경제 흐름, 절약, 금융과 재테크 정보',15,true),
  ('career','직장·커리어','briefcase','직장생활, 업무 노하우, 이직과 커리어 성장',16,true)
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,icon=EXCLUDED.icon,description=EXCLUDED.description,
  sort_order=EXCLUDED.sort_order,is_active=true,updated_at=now();

INSERT INTO boards(category_id,name,description)
SELECT id,name || ' 게시판',description
FROM categories
WHERE code IN ('society','ai-tech','finance','career')
ON CONFLICT(category_id) DO UPDATE SET
  name=EXCLUDED.name,description=EXCLUDED.description,is_active=true,updated_at=now();

CREATE TABLE IF NOT EXISTS search_logs (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  query varchar(80) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS search_logs_recent_idx ON search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS search_logs_query_user_recent_idx
  ON search_logs(query,user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS search_terms (
  query varchar(80) PRIMARY KEY,
  search_count integer NOT NULL DEFAULT 0,
  last_searched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;
