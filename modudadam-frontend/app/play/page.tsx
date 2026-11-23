import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, Compass, Gamepad2, Gift, HandCoins, HeartHandshake, Hourglass, Mail, MapPin, NotebookTabs, Shapes, ShieldQuestion, Sparkles, Store, Trophy, Vote } from "lucide-react";

export const metadata: Metadata = {
  title:"콘텐츠",description:"투표, 추리, 생활 미션, 기록과 이웃 이야기 등 목적별로 정리한 모두다담 콘텐츠를 만나보세요.",
  alternates:{ canonical:"/play" },robots:{ index:true,follow:true },
  openGraph:{ title:"콘텐츠",description:"투표, 추리, 생활 미션, 기록과 이웃 이야기 등 목적별로 정리한 모두다담 콘텐츠를 만나보세요.",url:"/play" },
};

const groups=[
  { id:"today",icon:Gamepad2,title:"오늘 즐기기",description:"매일 바뀌는 콘텐츠",items:[
    { href:"/play/choice",icon:Vote,tone:"coral",eyebrow:"매일 한 번",title:"오늘의 극한 밸런스",description:"두 선택 중 하나를 골라요." },
    { href:"/play/detective",icon:ShieldQuestion,tone:"blue",eyebrow:"오늘의 사건",title:"다담 추리방",description:"단서를 보고 정답을 찾아요." },
    { href:"/play/missions",icon:Trophy,tone:"amber",eyebrow:"생활 퀴즈",title:"다담 미션",description:"주제별 세 문제를 풀어요." },
    { href:"/play/taste",icon:Sparkles,tone:"purple",eyebrow:"10문항",title:"취향 발견실",description:"내 생활 취향을 확인해요." },
  ]},
  { id:"help",icon:HeartHandshake,title:"도움과 이야기",description:"질문과 익명 이야기",items:[
    { href:"/play/bounties",icon:HandCoins,tone:"amber",eyebrow:"도토리 보상",title:"현상금 질문",description:"답변이 필요한 질문을 올려요." },
    { href:"/play/mailbox",icon:Mail,tone:"blue",eyebrow:"고정 익명 ID",title:"다담 우체통",description:"익명으로 사연과 답장을 나눠요." },
    { href:"/play/treasures",icon:MapPin,tone:"green",eyebrow:"장소 추천",title:"동네 보물지도",description:"이웃이 등록한 장소를 찾아요." },
    { href:"/play/random",icon:Compass,tone:"amber",eyebrow:"무작위 게시글",title:"랜덤 이야기 여행",description:"게시글 하나를 무작위로 골라요." },
  ]},
  { id:"record",icon:NotebookTabs,title:"기록과 성장",description:"출석과 개인 기록",items:[
    { href:"/play/attendance",icon:CalendarCheck2,tone:"green",eyebrow:"하루 한 번",title:"다담 출석부",description:"오늘의 출석을 기록해요." },
    { href:"/play/challenges",icon:Trophy,tone:"coral",eyebrow:"생활 습관",title:"다담 챌린지",description:"목표를 정하고 인증해요." },
    { href:"/play/time-capsule",icon:Hourglass,tone:"purple",eyebrow:"예약 편지",title:"다담 타임캡슐",description:"정한 날짜까지 편지를 보관해요." },
  ]},
  { id:"acorn",icon:Store,title:"도토리",description:"선물과 상점",items:[
    { href:"/play/acorn-gift",icon:HandCoins,tone:"amber",eyebrow:"도토리 보내기",title:"도토리 선물하기",description:"다른 사용자에게 도토리를 보내요." },
    { href:"/play/stamps",icon:Gift,tone:"purple",eyebrow:"스탬프 구매",title:"도토리 상점",description:"도토리와 포인트를 사용해요." },
  ]},
] as const;

export default function PlayPage() {
  return <section className="content-hub-page grouped-content-hub">
    <header className="content-hub-hero"><span><Shapes size={27}/></span><div><h1>콘텐츠</h1><p>원하는 메뉴를 선택하세요.</p></div></header>
    <nav className="content-group-nav" aria-label="콘텐츠 빠른 이동">{groups.map(({ id,icon:Icon,title })=><a href={`#${id}`} key={id}><Icon size={17}/><span>{title}</span></a>)}</nav>
    <div className="content-group-list">{groups.map(({ id,icon:GroupIcon,title,description,items })=><section className="content-group" id={id} key={id}>
      <header><span><GroupIcon size={20}/></span><div><h2>{title}</h2><p>{description}</p></div><b>{items.length}개</b></header>
      <div className="content-hub-list">{items.map(({ href,icon:Icon,tone,eyebrow,title:itemTitle,description:itemDescription })=><Link href={href} key={href} className={`content-hub-card ${tone}${href==="/play/bounties" ? " featured-bounty" : ""}`}>
        <span className="content-hub-icon"><Icon size={22}/></span><span className="content-hub-copy"><small>{eyebrow}</small><strong>{itemTitle}</strong><p>{itemDescription}</p></span><ArrowRight size={18}/>
      </Link>)}</div>
    </section>)}</div>
  </section>;
}
