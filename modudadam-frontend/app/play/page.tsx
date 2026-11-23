import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ContentHub, type ContentHubData } from "@/components/content-hub";
import { API_SERVER_URL } from "@/lib/server-config";

export const metadata:Metadata={
  title:"콘텐츠",
  description:"질문 해결, 오늘의 참여, 기록과 이웃 이야기를 목적에 맞게 선택하세요.",
  alternates:{ canonical:"/play" },robots:{ index:true,follow:true },
  openGraph:{ title:"콘텐츠",description:"질문 해결, 오늘의 참여, 기록과 이웃 이야기를 목적에 맞게 선택하세요.",url:"/play" },
};

export default async function PlayPage() {
  return <ContentHub data={await getContentHub()}/>;
}

async function getContentHub():Promise<ContentHubData> {
  const cookieHeader=(await cookies()).toString();
  try {
    const response=await fetch(`${API_SERVER_URL}/api/features/content-hub`,{
      cache:"no-store",headers:cookieHeader ? { cookie:cookieHeader } : undefined,
    });
    if (!response.ok) return fallbackContentHub;
    const body=await response.json() as { success?:boolean;data?:ContentHubData };
    return body.success&&body.data ? body.data : fallbackContentHub;
  } catch { return fallbackContentHub; }
}

const fallbackContentHub:ContentHubData={
  authenticated:false,openBountyCount:0,dailyCompleted:0,dailyTotal:4,
  groups:[
    { code:"daily",title:"오늘 할 일",description:"매일 새로 열리는 콘텐츠",icon:"sparkles",items:[
      { code:"attendance",href:"/play/attendance",title:"다담 출석부",label:"하루 한 번",description:"오늘 출석을 기록해요.",icon:"calendar-check",tone:"green",status:{ state:"locked",label:"로그인 필요" } },
      { code:"choice",href:"/play/choice",title:"극한 밸런스",label:"오늘의 선택",description:"두 선택 중 하나를 골라요.",icon:"vote",tone:"coral",status:{ state:"locked",label:"로그인 필요" } },
      { code:"detective",href:"/play/detective",title:"다담 추리방",label:"오늘의 사건",description:"단서를 확인하고 정답을 찾아요.",icon:"shield-question",tone:"blue",status:{ state:"locked",label:"로그인 필요" } },
      { code:"missions",href:"/play/missions",title:"다담 미션",label:"생활 퀴즈",description:"주제를 골라 세 문제를 풀어요.",icon:"trophy",tone:"amber",status:{ state:"locked",label:"로그인 필요" } },
    ]},
    { code:"connect",title:"사람들과 나누기",description:"사연, 선물과 장소",icon:"heart-handshake",items:[
      { code:"bounty",href:"/play/bounties",title:"현상금 질문",label:"답변 요청",description:"도토리를 걸고 답변을 요청해요.",icon:"hand-coins",tone:"amber",status:null },
      { code:"mailbox",href:"/play/mailbox",title:"다담 우체통",label:"익명",description:"사연을 보내고 답장을 나눠요.",icon:"mail",tone:"blue",status:null },
      { code:"acorn-gift",href:"/play/acorn-gift",title:"도토리 선물",label:"선물",description:"다른 사용자에게 도토리를 보내요.",icon:"hand-coins",tone:"amber",status:null },
      { code:"treasures",href:"/play/treasures",title:"동네 보물지도",label:"장소",description:"이웃이 등록한 장소를 찾아요.",icon:"map-pin",tone:"green",status:null },
    ]},
    { code:"grow",title:"나를 쌓기",description:"습관, 기록과 취향",icon:"notebook-tabs",items:[
      { code:"challenges",href:"/play/challenges",title:"다담 챌린지",label:"습관",description:"목표를 정하고 매일 인증해요.",icon:"target",tone:"coral",status:null },
      { code:"time-capsule",href:"/play/time-capsule",title:"다담 타임캡슐",label:"예약 편지",description:"정한 날짜까지 편지를 보관해요.",icon:"hourglass",tone:"purple",status:null },
      { code:"taste",href:"/play/taste",title:"취향 발견실",label:"10문항",description:"생활 취향을 확인해요.",icon:"sparkles",tone:"purple",status:null },
    ]},
    { code:"explore",title:"둘러보기",description:"새 글 발견과 보상 관리",icon:"compass",items:[
      { code:"random",href:"/play/random",title:"랜덤 이야기",label:"무작위 게시글",description:"게시글 하나를 무작위로 보여드려요.",icon:"compass",tone:"amber",status:null },
      { code:"stamps",href:"/play/stamps",title:"도토리 상점",label:"보상 관리",description:"스탬프 구매와 포인트 전환",icon:"store",tone:"purple",status:null },
    ]},
  ],
};
