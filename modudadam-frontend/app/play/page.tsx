import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, Compass, Gamepad2, Gift, HandCoins, HeartHandshake, Hourglass, Mail, MapPin, NotebookTabs, Shapes, ShieldQuestion, Sparkles, Store, Trophy, Vote } from "lucide-react";

export const metadata: Metadata = {
  title:"콘텐츠",description:"투표, 추리, 생활 미션, 기록과 이웃 이야기 등 목적별로 정리한 모두다담 콘텐츠를 만나보세요.",
  alternates:{ canonical:"/play" },robots:{ index:true,follow:true },
  openGraph:{ title:"콘텐츠",description:"투표, 추리, 생활 미션, 기록과 이웃 이야기 등 목적별로 정리한 모두다담 콘텐츠를 만나보세요.",url:"/play" },
};

const groups=[
  { id:"today",icon:Gamepad2,title:"오늘 즐기기",description:"짧게 참여하고 바로 결과를 확인해요.",items:[
    { href:"/play/choice",icon:Vote,tone:"coral",eyebrow:"매일 한 번",title:"오늘의 극한 밸런스",description:"두 선택 중 하나를 고르고 모두의 답을 확인해요." },
    { href:"/play/detective",icon:ShieldQuestion,tone:"blue",eyebrow:"오늘의 사건",title:"다담 추리방",description:"단서를 조합해 거짓말한 한 사람을 찾아보세요." },
    { href:"/play/missions",icon:Trophy,tone:"amber",eyebrow:"생활 퀴즈",title:"다담 미션",description:"관심 주제의 세 문제에 도전해요." },
    { href:"/play/taste",icon:Sparkles,tone:"purple",eyebrow:"10문항 분석",title:"취향 발견실",description:"생활 선택으로 내 취향의 결을 발견해요." },
  ]},
  { id:"help",icon:HeartHandshake,title:"도움과 이야기",description:"질문하고 답하며 사람의 경험을 나눠요.",items:[
    { href:"/category/free/write",icon:HandCoins,tone:"amber",eyebrow:"도토리로 답변 요청",title:"현상금 질문하기",description:"좋은 답변에 도토리를 걸고 도움을 요청해요." },
    { href:"/play/mailbox",icon:Mail,tone:"blue",eyebrow:"고정 익명 ID",title:"다담 우체통",description:"이름을 내려놓고 사연과 답장을 나눠요." },
    { href:"/play/treasures",icon:MapPin,tone:"green",eyebrow:"이웃의 생활 지도",title:"동네 보물지도",description:"이웃이 직접 발견한 좋은 장소를 찾아요." },
    { href:"/play/random",icon:Compass,tone:"amber",eyebrow:"숨은 글 발견",title:"랜덤 이야기 여행",description:"목록 아래 잠들어 있던 이야기를 만나요." },
  ]},
  { id:"record",icon:NotebookTabs,title:"기록과 성장",description:"오늘의 실천과 마음을 시간 속에 쌓아요.",items:[
    { href:"/play/attendance",icon:CalendarCheck2,tone:"green",eyebrow:"하루 한 번",title:"다담 출석부",description:"출석을 기록하고 연속 출석을 이어가요." },
    { href:"/play/challenges",icon:Trophy,tone:"coral",eyebrow:"생활 습관",title:"다담 챌린지",description:"작은 목표를 정하고 꾸준히 인증해요." },
    { href:"/play/time-capsule",icon:Hourglass,tone:"purple",eyebrow:"미래의 나에게",title:"다담 타임캡슐",description:"오늘의 마음을 봉인하고 정한 날 다시 열어요." },
  ]},
  { id:"acorn",icon:Store,title:"도토리 관리",description:"모은 도토리를 확인하고 필요한 곳에 사용해요.",items:[
    { href:"/play/acorn-gift",icon:HandCoins,tone:"amber",eyebrow:"고마운 이웃에게",title:"도토리 선물하기",description:"메시지와 함께 보유 도토리를 나눠요." },
    { href:"/play/stamps",icon:Gift,tone:"purple",eyebrow:"꾸미기와 포인트",title:"도토리 상점",description:"스탬프를 구매하고 포인트 기능을 이용해요." },
  ]},
] as const;

export default function PlayPage() {
  return <section className="content-hub-page grouped-content-hub">
    <header className="content-hub-hero"><span><Shapes size={27}/></span><div><small>MODUDADAM CONTENTS</small><h1>무엇을 하고 싶으세요?</h1><p>목적을 먼저 고르면 필요한 콘텐츠를 빠르게 찾을 수 있어요.</p></div></header>
    <nav className="content-group-nav" aria-label="콘텐츠 빠른 이동">{groups.map(({ id,icon:Icon,title })=><a href={`#${id}`} key={id}><Icon size={17}/><span>{title}</span></a>)}</nav>
    <div className="content-group-list">{groups.map(({ id,icon:GroupIcon,title,description,items })=><section className="content-group" id={id} key={id}>
      <header><span><GroupIcon size={20}/></span><div><h2>{title}</h2><p>{description}</p></div><b>{items.length}개</b></header>
      <div className="content-hub-list">{items.map(({ href,icon:Icon,tone,eyebrow,title:itemTitle,description:itemDescription })=><Link href={href} key={href} className={`content-hub-card ${tone}`}>
        <span className="content-hub-icon"><Icon size={22}/></span><span className="content-hub-copy"><small>{eyebrow}</small><strong>{itemTitle}</strong><p>{itemDescription}</p></span><ArrowRight size={18}/>
      </Link>)}</div>
    </section>)}</div>
  </section>;
}
