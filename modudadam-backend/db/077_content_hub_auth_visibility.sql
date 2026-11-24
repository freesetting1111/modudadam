BEGIN;

-- 콘텐츠 허브에서 회원 전용 기능을 일관되게 안내할 수 있도록 인증 여부를 카탈로그에 저장합니다.
ALTER TABLE content_hub_items
  ADD COLUMN IF NOT EXISTS requires_auth boolean NOT NULL DEFAULT false;

UPDATE content_hub_items
SET requires_auth = code IN (
  'attendance',
  'choice',
  'detective',
  'missions',
  'acorn-gift',
  'stamps'
),
updated_at = now();

COMMENT ON COLUMN content_hub_items.requires_auth IS
  '로그아웃 상태에서 로그인 필요 배지와 기능별 안내 화면을 노출할지 여부';

COMMIT;
