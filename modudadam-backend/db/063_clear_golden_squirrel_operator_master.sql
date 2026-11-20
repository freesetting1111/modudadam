BEGIN;

UPDATE attendance_stamp_catalog
SET emoji = '/brand/stamps/catalog/v6/operator-operator_master.svg',
    description = '왕관을 쓴 황금 다람쥐로 단 하나의 최고 운영 권한을 상징하는 총관리자 전용 스탬프'
WHERE code = 'operator_master'
  AND access_scope = 'operator';

COMMIT;
