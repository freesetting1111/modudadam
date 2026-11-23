"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,CalendarCheck2,Check,Compass,Gift,HandCoins,HeartHandshake,Hourglass,
  LockKeyhole,Mail,MapPin,NotebookTabs,Shapes,ShieldQuestion,Sparkles,Store,Target,Trophy,Vote,
} from "lucide-react";

export type ContentHubStatus={ state:"todo"|"active"|"done"|"locked";label:string };
export type ContentHubItem={ code:string;href:string;title:string;label:string;description:string;icon:string;tone:"blue"|"coral"|"amber"|"green"|"purple";status:ContentHubStatus|null };
export type ContentHubGroup={ code:string;title:string;description:string;icon:string;items:ContentHubItem[] };
export type ContentHubData={ authenticated:boolean;openBountyCount:number;dailyCompleted:number;dailyTotal:number;groups:ContentHubGroup[] };

const icons:Record<string,LucideIcon>={
  "calendar-check":CalendarCheck2,vote:Vote,"shield-question":ShieldQuestion,trophy:Trophy,
  mail:Mail,"hand-coins":HandCoins,"map-pin":MapPin,target:Target,hourglass:Hourglass,
  sparkles:Sparkles,compass:Compass,store:Store,gift:Gift,"heart-handshake":HeartHandshake,
  "notebook-tabs":NotebookTabs,shapes:Shapes,
};

export function ContentHub({ data }:{ data:ContentHubData }) {
  const daily=data.groups.find((group)=>group.code==="daily");
  const browseGroups=data.groups.filter((group)=>group.code!=="daily").map((group)=>({ ...group,items:group.items.filter((item)=>item.code!=="bounty") })).filter((group)=>group.items.length);
  const progress=data.dailyTotal ? Math.round(data.dailyCompleted/data.dailyTotal*100) : 0;

  return <section className="content-hub-page content-journey-hub">
    <header className="content-journey-hero">
      <span><Shapes size={25}/></span>
      <div><small>모두다담 콘텐츠</small><h1>오늘, 무엇을 할까요?</h1><p>목적에 맞는 메뉴를 바로 선택하세요.</p></div>
    </header>

    <section className="content-primary-action" aria-labelledby="content-primary-title">
      <div className="content-primary-icon"><HandCoins size={28}/></div>
      <div className="content-primary-copy"><small>빠르게 도움받기</small><h2 id="content-primary-title">답이 필요한 질문이 있나요?</h2><p>도토리 현상금을 걸면 금액이 높은 질문부터 노출됩니다.</p><span>{data.openBountyCount ? `답변 대기 ${data.openBountyCount.toLocaleString()}건` : "첫 질문을 등록해 보세요"}</span></div>
      <div className="content-primary-buttons">
        <TrackedLink href="/play/bounties/write" itemCode="bounty" placement="primary" className="primary">질문 올리기<ArrowRight size={17}/></TrackedLink>
        <TrackedLink href="/play/bounties" itemCode="bounty" placement="primary">질문 둘러보기</TrackedLink>
      </div>
    </section>

    {daily&&<section className="daily-action-board" id="daily" aria-labelledby="daily-action-title">
      <header><div><small>오늘의 루틴</small><h2 id="daily-action-title">오늘 할 일</h2></div><div className="daily-progress-copy"><strong>{data.authenticated ? `${data.dailyCompleted}/${data.dailyTotal}` : "로그인 후 표시"}</strong><span>완료</span></div></header>
      <div className="daily-progress-track" aria-label={data.authenticated ? `오늘 할 일 ${data.dailyCompleted}개 완료` : "로그인이 필요합니다"}><i style={{ width:`${data.authenticated ? progress : 0}%` }}/></div>
      <div className="daily-action-grid">{daily.items.map((item)=>{
        const Icon=icons[item.icon] || Sparkles;const status=item.status;
        return <TrackedLink href={item.href} itemCode={item.code} placement="daily" className={`daily-action-card ${item.tone} ${status?.state || "todo"}`} key={item.code}>
          <span className="daily-action-icon"><Icon size={21}/></span><span className="daily-action-copy"><small>{item.label}</small><strong>{item.title}</strong></span>
          <em>{status?.state==="done"&&<Check size={13}/>} {status?.state==="locked"&&<LockKeyhole size={12}/>} {status?.label || "시작하기"}</em>
        </TrackedLink>;
      })}</div>
    </section>}

    <nav className="content-intent-nav" aria-label="콘텐츠 빠른 이동">
      <a href="#daily"><Sparkles size={16}/>오늘</a>
      {browseGroups.map((group)=>{const Icon=icons[group.icon] || Shapes;return <a href={`#${group.code}`} key={group.code}><Icon size={16}/>{group.title}</a>;})}
    </nav>

    <div className="content-purpose-groups">{browseGroups.map((group)=>{
      const GroupIcon=icons[group.icon] || Shapes;
      return <section className="content-purpose-group" id={group.code} key={group.code}>
        <header><span><GroupIcon size={19}/></span><div><h2>{group.title}</h2><p>{group.description}</p></div></header>
        <div className="content-purpose-grid">{group.items.map((item)=>{const Icon=icons[item.icon] || Sparkles;return <TrackedLink href={item.href} itemCode={item.code} placement="group" className={`content-purpose-card ${item.tone}`} key={item.code}>
          <span className="content-purpose-icon"><Icon size={22}/></span><span className="content-purpose-copy"><small>{item.label}</small><strong>{item.title}</strong><p>{item.description}</p>{item.status&&<em className={item.status.state}>{item.status.label}</em>}</span><ArrowRight size={17}/>
        </TrackedLink>;})}</div>
      </section>;
    })}</div>
  </section>;
}

function TrackedLink({ href,itemCode,placement,className,children }:{ href:string;itemCode:string;placement:"primary"|"daily"|"group";className?:string;children:React.ReactNode }) {
  return <Link href={href} className={className} onClick={()=>trackContentClick(itemCode,placement)}>{children}</Link>;
}

function trackContentClick(itemCode:string,placement:string) {
  try {
    const storageKey="modudadam_content_visitor";
    let visitorKey=window.localStorage.getItem(storageKey);
    if (!visitorKey) { visitorKey=window.crypto.randomUUID();window.localStorage.setItem(storageKey,visitorKey); }
    const body=JSON.stringify({ itemCode,placement,visitorKey });
    if (navigator.sendBeacon) { navigator.sendBeacon("/api/features/content-hub",new Blob([body],{ type:"application/json" }));return; }
    void fetch("/api/features/content-hub",{ method:"POST",headers:{ "Content-Type":"application/json" },body,keepalive:true });
  } catch { /* 이동을 막지 않도록 기록 실패는 무시합니다. */ }
}
