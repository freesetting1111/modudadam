BEGIN;

-- 등급 공통 이미지를 반복하지 않고 각 스탬프 코드별 전용 벡터 이미지를 연결합니다.
UPDATE attendance_stamp_catalog
SET emoji = '/brand/stamps/catalog/' || rarity || '-' || code || '.svg'
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
