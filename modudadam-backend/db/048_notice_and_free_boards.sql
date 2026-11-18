BEGIN;

INSERT INTO categories(code,name,icon,description,sort_order,is_active)
VALUES
  ('notice','공지사항','📢','모두다담의 중요한 소식과 이용 안내',-2,true),
  ('free','자유게시판','💬','주제에 관계없이 편하게 이야기를 나누는 공간',-1,true)
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,
  icon=EXCLUDED.icon,
  description=EXCLUDED.description,
  sort_order=EXCLUDED.sort_order,
  is_active=true,
  updated_at=now();

INSERT INTO boards(category_id,name,description,read_permission,write_permission,is_active)
SELECT
  categories.id,
  categories.name,
  categories.description,
  'public',
  CASE WHEN categories.code='notice' THEN 'admin' ELSE 'member' END,
  true
FROM categories
WHERE categories.code IN ('notice','free')
ON CONFLICT(category_id) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  read_permission=EXCLUDED.read_permission,
  write_permission=EXCLUDED.write_permission,
  is_active=true,
  updated_at=now();

UPDATE posts
SET is_notice=true,
    updated_at=now()
WHERE category_id=(SELECT id FROM categories WHERE code='notice')
  AND is_notice=false;

COMMIT;
