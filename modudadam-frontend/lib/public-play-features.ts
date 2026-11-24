import type { Metadata } from "next";

export type PublicPlayFeatureCode =
  | "attendance"
  | "choice"
  | "detective"
  | "mailbox"
  | "missions"
  | "stamps"
  | "taste"
  | "time-capsule"
  | "treasures";

export type PublicPlayFeature = {
  code: PublicPlayFeatureCode;
  path: `/play/${string}`;
  eyebrow: string;
  title: string;
  description: string;
  summary: string;
  icon: "calendar" | "choice" | "detective" | "mailbox" | "missions" | "stamps" | "taste" | "time-capsule" | "treasures";
  tone: "blue" | "coral" | "amber" | "green" | "purple";
  actionLabel: string;
  points: Array<{ title: string; description: string }>;
};

export const publicPlayFeatures: Record<PublicPlayFeatureCode, PublicPlayFeature> = {
  attendance: {
    code:"attendance",path:"/play/attendance",eyebrow:"매일 출석",title:"다담 출석부",icon:"calendar",tone:"green",actionLabel:"로그인하고 출석하기",
    description:"하루 한 번 출석을 기록하고 연속 출석 보상과 스탬프를 모아보세요.",
    summary:"출석 기록은 매일 새로 열립니다. 꾸준히 참여하면 도토리와 수집 보상을 받을 수 있어요.",
    points:[{ title:"하루 한 번",description:"오늘의 출석을 간단히 기록합니다." },{ title:"연속 출석",description:"이어진 출석 기록을 한눈에 확인합니다." },{ title:"수집 보상",description:"도토리와 출석 스탬프를 모읍니다." }],
  },
  choice: {
    code:"choice",path:"/play/choice",eyebrow:"오늘의 선택",title:"오늘의 극한 밸런스",icon:"choice",tone:"coral",actionLabel:"로그인하고 선택하기",
    description:"매일 달라지는 두 선택 중 하나를 고르고 이웃들의 선택 비율을 확인하세요.",
    summary:"정답이 없는 생활 속 선택을 함께 나눕니다. 하루 한 번 참여하고 다음 결과를 기다려 보세요.",
    points:[{ title:"매일 새 주제",description:"자정마다 새로운 선택이 열립니다." },{ title:"실시간 비율",description:"참여 후 전체 선택 결과를 확인합니다." },{ title:"참여 보상",description:"마감 결과에 따라 도토리를 받습니다." }],
  },
  detective: {
    code:"detective",path:"/play/detective",eyebrow:"오늘의 사건",title:"다담 추리방",icon:"detective",tone:"blue",actionLabel:"로그인하고 사건 풀기",
    description:"열 명의 용의자와 세 가지 단서를 살펴보고 오늘의 사건을 해결해 보세요.",
    summary:"사건과 결론 후보는 매일 새로 준비됩니다. 기록을 비교하고 가장 타당한 결론을 선택하세요.",
    points:[{ title:"매일 새 사건",description:"새로운 기록과 결론 후보를 만납니다." },{ title:"단서 3개",description:"막힐 때 단서를 한 번씩 확인합니다." },{ title:"세 번의 기회",description:"남은 기회를 살피며 결론을 선택합니다." }],
  },
  mailbox: {
    code:"mailbox",path:"/play/mailbox",eyebrow:"익명 사연",title:"다담 우체통",icon:"mailbox",tone:"blue",actionLabel:"로그인하고 사연 나누기",
    description:"고정된 익명 ID로 생활 속 고민과 마음을 전하고 이웃의 답장을 받아보세요.",
    summary:"닉네임 대신 익명 ID로 대화합니다. 공개 게시판과 다른 방식으로 사연과 답장을 이어갈 수 있어요.",
    points:[{ title:"고정 익명 ID",description:"대화의 흐름은 유지하고 닉네임은 숨깁니다." },{ title:"사연 보내기",description:"말하기 어려웠던 마음을 차분히 적습니다." },{ title:"답장 나누기",description:"도움이 되는 경험과 마음을 전합니다." }],
  },
  missions: {
    code:"missions",path:"/play/missions",eyebrow:"생활 퀴즈",title:"다담 미션",icon:"missions",tone:"amber",actionLabel:"로그인하고 미션 시작하기",
    description:"관심 있는 생활 분야를 골라 매일 새로운 세 문제에 도전해 보세요.",
    summary:"짧은 문제와 해설로 생활 지식을 확인합니다. 매일 한 번씩 새로운 문제를 풀 수 있어요.",
    points:[{ title:"분야 선택",description:"관심 있는 생활 주제로 시작합니다." },{ title:"세 문제",description:"부담 없이 짧게 풀고 결과를 확인합니다." },{ title:"정답 해설",description:"틀린 문제도 해설로 다시 확인합니다." }],
  },
  stamps: {
    code:"stamps",path:"/play/stamps",eyebrow:"보상과 수집",title:"도토리 상점",icon:"stamps",tone:"purple",actionLabel:"로그인하고 상점 보기",
    description:"모은 도토리와 활동 포인트로 등급별 스탬프를 구매하고 대표 스탬프를 꾸며보세요.",
    summary:"스탬프는 새싹부터 신화까지 단계적으로 성장합니다. 구매한 스탬프는 닉네임 옆에 적용할 수 있어요.",
    points:[{ title:"계단형 등급",description:"등급이 오를수록 더 특별한 디자인을 만납니다." },{ title:"활동별 상점",description:"도토리와 선행·악행 포인트를 목적에 맞게 씁니다." },{ title:"대표 스탬프",description:"구매한 스탬프를 작성자 표시에 적용합니다." }],
  },
  taste: {
    code:"taste",path:"/play/taste",eyebrow:"생활 취향",title:"취향 발견실",icon:"taste",tone:"purple",actionLabel:"로그인하고 취향 찾기",
    description:"열 개의 생활 선택에 답하고 나에게 잘 맞는 취향 유형을 확인해 보세요.",
    summary:"복잡한 검사 대신 일상적인 선택으로 취향을 살펴봅니다. 결과는 다시 참여해 비교할 수 있어요.",
    points:[{ title:"10개 질문",description:"일상에서 마주치는 선택에 답합니다." },{ title:"취향 결과",description:"응답을 바탕으로 생활 취향을 정리합니다." },{ title:"결과 공유",description:"발견한 취향을 다른 사람과 나눕니다." }],
  },
  "time-capsule": {
    code:"time-capsule",path:"/play/time-capsule",eyebrow:"예약 편지",title:"다담 타임캡슐",icon:"time-capsule",tone:"purple",actionLabel:"로그인하고 편지 보관하기",
    description:"오늘의 마음을 적고 원하는 날짜를 정해 미래의 나에게 편지를 남겨보세요.",
    summary:"보관한 편지는 정한 날짜가 되기 전까지 봉인됩니다. 시간이 지난 뒤 오늘의 기록을 다시 만날 수 있어요.",
    points:[{ title:"날짜 선택",description:"편지를 다시 열 날짜를 직접 정합니다." },{ title:"봉인 보관",description:"열람일까지 내용을 안전하게 가립니다." },{ title:"미래의 기록",description:"시간이 흐른 뒤 오늘의 마음을 확인합니다." }],
  },
  treasures: {
    code:"treasures",path:"/play/treasures",eyebrow:"이웃 추천 장소",title:"동네 보물지도",icon:"treasures",tone:"green",actionLabel:"로그인하고 보물 찾기",
    description:"이웃이 직접 발견한 식당, 산책길, 편의시설과 생활 속 좋은 장소를 찾아보세요.",
    summary:"광고 목록이 아니라 사용자가 직접 남긴 장소를 모읍니다. 지도에서 위치를 확인하고 나만의 장소도 등록할 수 있어요.",
    points:[{ title:"생활 장소",description:"일상에 도움이 되는 장소를 주제별로 찾습니다." },{ title:"지도 확인",description:"주소와 위치를 지도에서 바로 확인합니다." },{ title:"이웃 추천",description:"직접 발견한 장소와 이유를 함께 남깁니다." }],
  },
};

export const publicPlayFeaturePaths = Object.values(publicPlayFeatures).map((feature) => feature.path);

export function publicPlayFeatureMetadata(code:PublicPlayFeatureCode):Metadata {
  const feature=publicPlayFeatures[code];
  return {
    title:feature.title,
    description:feature.description,
    alternates:{ canonical:feature.path },
    robots:{ index:true,follow:true },
    openGraph:{ type:"website",title:`${feature.title} | 모두다담`,description:feature.description,url:feature.path,siteName:"모두다담",locale:"ko_KR" },
    twitter:{ card:"summary",title:`${feature.title} | 모두다담`,description:feature.description },
  };
}
