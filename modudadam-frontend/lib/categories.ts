import {
  Baby, BellRing, BookOpenText, Bot, BriefcaseBusiness, CarFront, ChartNoAxesCombined,
  Clapperboard, CookingPot, Dumbbell, House, Landmark, Luggage, MapPinned,
  MessageSquareText, Palette, PawPrint, Sparkles,
} from "lucide-react";

export const specialBoards = [
  { code:"notice",name:"공지사항",icon:BellRing,short:"공지사항",description:"모두다담의 중요한 소식과 이용 안내" },
  { code:"free",name:"자유게시판",icon:MessageSquareText,short:"자유게시판",description:"주제에 관계없이 편하게 이야기를 나누는 공간" },
] as const;

export const categories = [
  { code: "pets", name: "동물·반려동물", icon: PawPrint, short: "반려동물", description: "반려동물 기록, 양육 정보, 용품과 장소" },
  { code: "food", name: "음식·요리", icon: CookingPot, short: "음식·요리", description: "레시피, 식단, 식재료와 장보기" },
  { code: "home", name: "집·주거·살림", icon: House, short: "집·살림", description: "집 꾸미기, 청소, 수납, 수리와 가전" },
  { code: "hobby", name: "취미·수집", icon: Palette, short: "취미·수집", description: "작품, 장비, 수집품과 취미 정보" },
  { code: "travel", name: "여행·나들이", icon: Luggage, short: "여행", description: "여행지, 일정, 여행 기록과 동행" },
  { code: "wellness", name: "운동·생활습관", icon: Dumbbell, short: "운동·습관", description: "운동 기록, 목표, 루틴과 챌린지" },
  { code: "family", name: "육아·가족", icon: Baby, short: "육아·가족", description: "성장 기록, 놀이, 가족 일정과 육아 정보" },
  { code: "mobility", name: "자동차·이동생활", icon: CarFront, short: "자동차", description: "차량 관리, 정비 이력, 유지비와 드라이브" },
  { code: "style", name: "패션·뷰티", icon: Sparkles, short: "패션·뷰티", description: "옷장, 코디, 제품 기록과 취향" },
  { code: "learning", name: "학습·자기계발", icon: BookOpenText, short: "학습", description: "학습 기록, 목표, 자료와 스터디" },
  { code: "local", name: "지역·동네생활", icon: MapPinned, short: "동네생활", description: "동네 장소, 행사, 모임과 생활 정보" },
  { code: "culture", name: "문화·콘텐츠", icon: Clapperboard, short: "문화", description: "영화, 책, 게임, 공연과 감상 기록" },
  { code: "society", name: "사회·이슈", icon: Landmark, short: "사회·이슈", description: "사회 현상, 정책, 뉴스와 다양한 관점" },
  { code: "ai-tech", name: "AI·기술", icon: Bot, short: "AI·기술", description: "인공지능, 디지털 기술, 서비스와 활용 경험" },
  { code: "finance", name: "경제·재테크", icon: ChartNoAxesCombined, short: "경제·재테크", description: "경제 흐름, 절약, 금융과 재테크 정보" },
  { code: "career", name: "직장·커리어", icon: BriefcaseBusiness, short: "직장·커리어", description: "직장생활, 업무 노하우, 이직과 커리어 성장" },
] as const;

export function findCategory(code: string) { return categories.find((category) => category.code === code); }
export function findBoard(code:string) { return specialBoards.find((board) => board.code===code) || findCategory(code); }
export function isNoticeBoard(code:string) { return code==="notice"; }
