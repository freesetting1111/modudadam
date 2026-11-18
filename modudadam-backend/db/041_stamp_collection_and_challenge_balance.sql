BEGIN;

ALTER TABLE attendance_stamp_catalog ADD COLUMN IF NOT EXISTS rarity varchar(20) NOT NULL DEFAULT 'common';

CREATE OR REPLACE FUNCTION user_stamp_emoji(target_user_id uuid) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT catalog.emoji
    FROM user_attendance_stamps owned
    JOIN attendance_stamp_catalog catalog ON catalog.code=owned.stamp_code
   WHERE owned.user_id=target_user_id AND owned.equipped
   LIMIT 1
$$;

UPDATE dadam_challenges SET daily_acorns=0,
  completion_acorns=CASE WHEN goal_days>=14 THEN 30 WHEN goal_days>=7 THEN 15 ELSE 10 END;

INSERT INTO attendance_stamp_catalog(code,name,emoji,description,price,sort_order,rarity) VALUES
('basic','첫 발자국','🐾','모두다담 출석부의 기본 스탬프',0,1,'uncommon'),
('sprout','새싹','🌱','조금씩 자라는 중이에요',0,2,'uncommon'),
('acorn','도토리 한 알','🌰','차곡차곡 모으는 즐거움',8,3,'uncommon'),
('clover','행운의 클로버','🍀','기분 좋은 하루를 남기는 스탬프',12,4,'uncommon'),
('sun','포근한 햇살','☀️','따뜻하게 빛난 하루의 기록',15,5,'uncommon'),
('moon','고요한 달빛','🌙','차분하게 하루를 마친 기록',15,6,'uncommon'),
('flower','다정한 꽃','🌼','마음이 피어난 날의 기록',20,7,'uncommon'),
('cloud','몽글 구름','☁️','느긋하고 포근한 하루',20,8,'uncommon'),
('leaf','초록 잎사귀','🍃','싱그러운 마음의 표시',22,9,'uncommon'),
('coffee','커피 한 잔','☕','잠깐의 여유를 즐기는 사람',24,10,'uncommon'),
('bread','따끈한 빵','🍞','소소하고 든든한 행복',24,11,'uncommon'),
('heart','다정한 마음','💛','따뜻한 마음을 건네는 표시',25,12,'uncommon'),
('star','작은 별','⭐','오늘도 반짝인 나의 기록',25,13,'uncommon'),
('cat','느긋한 고양이','🐱','내 속도로 하루를 즐겨요',28,14,'uncommon'),
('dog','신나는 강아지','🐶','즐거운 에너지가 가득해요',28,15,'uncommon'),
('rabbit','포근한 토끼','🐰','부드럽고 다정한 하루',30,16,'uncommon'),
('squirrel','다담 다람쥐','🐿️','도토리를 사랑하는 수집가',30,17,'uncommon'),
('cherry','상큼한 체리','🍒','기분 좋은 생기를 더해요',32,18,'uncommon'),
('lemon','반짝 레몬','🍋','상쾌하게 시작하는 하루',32,19,'uncommon'),
('tulip','봄날 튤립','🌷','설레는 계절을 담은 표시',35,20,'common'),
('maple','가을 단풍','🍁','깊어지는 계절의 기록',38,21,'common'),
('snow','첫눈','❄️','조용히 내려앉은 특별한 날',38,22,'common'),
('umbrella','비 오는 날','☔','빗소리와 함께한 하루',40,23,'common'),
('rainbow','무지개','🌈','꾸준함 끝에 만난 특별한 기록',45,24,'common'),
('butterfly','나비의 날개','🦋','새로운 변화를 응원해요',48,25,'common'),
('bee','부지런한 꿀벌','🐝','오늘도 알차게 움직였어요',48,26,'common'),
('ladybug','행운의 무당벌레','🐞','작은 행운을 곁에 두어요',50,27,'common'),
('whale','푸른 고래','🐳','넓고 여유로운 마음',52,28,'common'),
('dolphin','파도 타는 돌고래','🐬','경쾌하게 하루를 건너요',55,29,'common'),
('penguin','다정한 펭귄','🐧','함께라서 더 따뜻해요',55,30,'common'),
('fox','별빛 여우','🦊','영리하고 반짝이는 취향',60,31,'rare'),
('owl','밤의 부엉이','🦉','고요한 밤에 빛나는 집중력',60,32,'rare'),
('panda','평온한 판다','🐼','느긋함도 소중한 능력이에요',65,33,'rare'),
('unicorn','꿈꾸는 유니콘','🦄','상상력을 잃지 않는 사람',75,34,'rare'),
('rocket','우주 탐험가','🚀','새로운 곳을 향해 출발해요',75,35,'rare'),
('planet','나만의 행성','🪐','뚜렷한 세계를 가진 사람',80,36,'rare'),
('comet','별똥별','☄️','빠르게 빛난 특별한 순간',85,37,'rare'),
('crystal','빛나는 보석','💎','꾸준함으로 완성한 반짝임',90,38,'rare'),
('crown','황금 왕관','👑','성실한 수집가의 품격',100,39,'rare'),
('fire','열정의 불꽃','🔥','쉽게 꺼지지 않는 마음',100,40,'rare'),
('purple_heart','보랏빛 마음','💜','깊고 선명한 취향의 표시',110,41,'epic'),
('blue_heart','푸른 마음','💙','맑고 단단한 마음의 표시',110,42,'epic'),
('magic','마법의 반짝임','✨','평범한 날을 특별하게 만들어요',120,43,'epic'),
('artist','취향 예술가','🎨','자신만의 색을 가진 사람',130,44,'epic'),
('music','마음의 선율','🎵','일상에 리듬을 더해요',130,45,'epic'),
('trophy','챌린지 마스터','🏆','꾸준한 실천으로 얻은 영광',150,46,'epic'),
('medal','다담 메달','🏅','포기하지 않은 날들의 증표',170,47,'epic'),
('galaxy','은하수 여행자','🌌','수많은 기록이 만든 우주',200,48,'legendary'),
('phoenix','불멸의 불사조','🔥🪽','다시 시작할 줄 아는 사람',250,49,'legendary'),
('royal_squirrel','도토리 왕국의 주인','👑🐿️','도토리 수집가가 도달한 특별한 자리',300,50,'legendary'),
('aurora_crown','오로라 왕관','🌈👑','긴 시간 쌓아 올린 눈부신 기록',400,51,'mythic'),
('modudadam_master','모두다담 마스터','👑✨🌰','모든 일상을 다정하게 담아낸 최종 스탬프',500,52,'mythic')
ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,emoji=EXCLUDED.emoji,description=EXCLUDED.description,price=EXCLUDED.price,sort_order=EXCLUDED.sort_order,rarity=EXCLUDED.rarity,enabled=true;

COMMIT;
