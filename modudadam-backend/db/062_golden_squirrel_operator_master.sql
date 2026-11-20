BEGIN;

UPDATE attendance_stamp_catalog
SET emoji = '/brand/stamps/catalog/v5/operator-operator_master.svg',
    description = '황금 다람쥐와 왕관으로 단 하나의 최고 운영 권한을 상징하는 최상위 관리자 스탬프'
WHERE code = 'operator_master'
  AND access_scope = 'operator';

COMMIT;
