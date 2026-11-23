BEGIN;

-- 현상금 질문은 자유게시판의 부가 옵션이 아니라 별도 도움 요청 서비스입니다.
INSERT INTO categories(code,name,icon,description,sort_order,is_active)
VALUES ('bounty','현상금 질문','🌰','도토리를 걸고 경험 있는 이웃의 답변을 요청하는 공간',-3,true)
ON CONFLICT(code) DO UPDATE SET
  name=EXCLUDED.name,
  icon=EXCLUDED.icon,
  description=EXCLUDED.description,
  sort_order=EXCLUDED.sort_order,
  is_active=true,
  updated_at=now();

INSERT INTO boards(category_id,name,description,read_permission,write_permission,is_active)
SELECT categories.id,categories.name,categories.description,'public','member',true
FROM categories WHERE categories.code='bounty'
ON CONFLICT(category_id) DO UPDATE SET
  name=EXCLUDED.name,
  description=EXCLUDED.description,
  read_permission=EXCLUDED.read_permission,
  write_permission=EXCLUDED.write_permission,
  is_active=true,
  updated_at=now();

-- 기존에 자유게시판 등에서 작성된 현상금 글도 전용 공간으로 모읍니다.
UPDATE posts
SET category_id=(SELECT id FROM categories WHERE code='bounty'),
    post_type='bounty_question',
    updated_at=now()
WHERE EXISTS (
  SELECT 1 FROM post_acorn_bounties bounty WHERE bounty.post_id=posts.id
);

UPDATE acorn_economy_settings
SET setting_value=300,
    description='현상금 질문 최대 금액',
    updated_at=now()
WHERE setting_key='bounty_maximum';

-- 이미 등록된 과거 현상금은 보존하되, 앞으로는 전용 카테고리와 3단계 금액만 허용합니다.
CREATE OR REPLACE FUNCTION validate_new_post_acorn_bounty() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target_category varchar(40);
  target_type varchar(40);
BEGIN
  SELECT categories.code,posts.post_type
    INTO target_category,target_type
  FROM posts JOIN categories ON categories.id=posts.category_id
  WHERE posts.id=NEW.post_id;

  IF target_category IS DISTINCT FROM 'bounty' OR target_type IS DISTINCT FROM 'bounty_question' THEN
    RAISE EXCEPTION '답변 현상금은 현상금 질문에만 등록할 수 있습니다.';
  END IF;
  IF NEW.amount NOT IN (100,200,300) THEN
    RAISE EXCEPTION '답변 현상금은 100, 200, 300개 중에서 선택해야 합니다.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS post_acorn_bounties_validate_new ON post_acorn_bounties;
CREATE TRIGGER post_acorn_bounties_validate_new
BEFORE INSERT ON post_acorn_bounties
FOR EACH ROW EXECUTE FUNCTION validate_new_post_acorn_bounty();

COMMIT;
