BEGIN;

-- 071에서 무료 도토리 순발행을 하루 최대 5개로 제한했으므로,
-- 기존 전체 구매가(약 24,430개)를 그대로 두면 컬렉션 완주가 비현실적으로 길어집니다.
-- 초반에는 짧은 주기로 구매 성취를 주고, 상위 등급으로 갈수록 가격이 가파르게
-- 상승하도록 공개 판매 스탬프만 다시 가격을 책정합니다.
--
-- 선행/악행 특별 스탬프(access_scope='reputation')는 도토리가 아니라
-- 각 평판 포인트로 구매하므로 이 조정에서 제외합니다.
-- 업적/운영자 스탬프도 판매 상품이 아니므로 제외합니다.

CREATE TABLE IF NOT EXISTS public_stamp_price_policy (
  rarity varchar(20) PRIMARY KEY,
  base_price integer NOT NULL CHECK (base_price > 0),
  price_step integer NOT NULL CHECK (price_step >= 0),
  target_order smallint NOT NULL UNIQUE CHECK (target_order > 0),
  description varchar(200) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public_stamp_price_policy
  (rarity,base_price,price_step,target_order,description)
VALUES
  ('uncommon',5,1,1,'첫 구매를 빠르게 경험하는 새싹 등급'),
  ('common',25,3,2,'꾸준한 활동으로 수집하는 일반 등급'),
  ('rare',60,5,3,'선택과 저축이 필요한 희귀 등급'),
  ('epic',120,15,4,'장기 활동의 성취를 나타내는 영웅 등급'),
  ('legendary',300,150,5,'소수만 완성하는 전설 등급'),
  ('mythic',800,400,6,'최상위 장기 목표인 신화 등급')
ON CONFLICT (rarity) DO UPDATE SET
  base_price=EXCLUDED.base_price,
  price_step=EXCLUDED.price_step,
  target_order=EXCLUDED.target_order,
  description=EXCLUDED.description,
  updated_at=now();

-- 기본 제공 스탬프는 계속 무료입니다.
UPDATE attendance_stamp_catalog
SET price=0
WHERE code IN ('basic','sprout')
  AND access_scope='public';

WITH ranked AS (
  SELECT
    catalog.code,
    catalog.rarity,
    row_number() OVER (
      PARTITION BY catalog.rarity
      ORDER BY catalog.sort_order,catalog.code
    ) AS tier_order
  FROM attendance_stamp_catalog catalog
  JOIN public_stamp_price_policy policy ON policy.rarity=catalog.rarity
  WHERE catalog.access_scope='public'
    AND catalog.enabled
    AND catalog.code NOT IN ('basic','sprout')
)
UPDATE attendance_stamp_catalog catalog
SET price=policy.base_price+((ranked.tier_order-1)*policy.price_step)
FROM ranked
JOIN public_stamp_price_policy policy ON policy.rarity=ranked.rarity
WHERE catalog.code=ranked.code;

COMMIT;
