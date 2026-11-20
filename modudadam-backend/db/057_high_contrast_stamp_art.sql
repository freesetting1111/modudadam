BEGIN;

-- 작은 화면에서도 중앙 문양이 선명하게 보이는 고대비 스탬프 이미지로 교체합니다.
-- v2 경로를 사용해 브라우저와 CDN의 이전 이미지 캐시도 함께 무효화합니다.
UPDATE attendance_stamp_catalog
SET emoji = '/brand/stamps/catalog/v2/' || rarity || '-' || code || '.svg'
WHERE enabled
  AND code IN (
    'basic','sprout','acorn','clover','sun','moon','flower','cloud','leaf','coffee','bread','heart','star','cat','dog','rabbit','squirrel','cherry','lemon',
    'tulip','maple','snow','umbrella','rainbow','butterfly','bee','ladybug','whale','dolphin','penguin',
    'fox','owl','panda','unicorn','rocket','planet','comet','crystal','crown','fire',
    'purple_heart','blue_heart','magic','artist','music','trophy','medal','galaxy','phoenix','royal_squirrel','aurora_crown','modudadam_master',
    'operator_guardian','operator_starseed','operator_master',
    'reward_sprout_keeper','reward_daily_collector','reward_rare_explorer','reward_heroic_archivist','reward_legend_keeper','reward_dadam_grandmaster',
    'kindness_100','kindness_500','kindness_1000','kindness_5000','kindness_10000',
    'misdeed_100','misdeed_500','misdeed_1000','misdeed_5000','misdeed_10000'
  );

COMMIT;
