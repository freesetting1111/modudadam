BEGIN;

INSERT INTO categories(code,name,icon,description,sort_order,is_active)
VALUES ('anonymous','익명게시판','🕶️','닉네임을 숨기고 솔직한 이야기를 나누는 공간',0,true)
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
  'member',
  true
FROM categories
WHERE categories.code='anonymous'
ON CONFLICT(category_id) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  read_permission=EXCLUDED.read_permission,
  write_permission=EXCLUDED.write_permission,
  is_active=true,
  updated_at=now();

COMMIT;
