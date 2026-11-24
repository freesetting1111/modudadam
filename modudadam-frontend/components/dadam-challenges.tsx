"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Target, Users } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Challenge={
  id:string;title:string;description:string;icon:string;categoryName:string;goalDays:number;periodDays:number;
  participantCount:number;enrollmentId:string|null;enrollmentStatus:string|null;checkinCount:number;checkedToday:boolean;
};

export function DadamChallenges({ authenticated }:{ authenticated:boolean }) {
  const router=useRouter();
  const [items,setItems]=useState<Challenge[]>([]);
  const [loading,setLoading]=useState(true);
  const [pendingId,setPendingId]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try { const data=await apiRequest<{ challenges:Challenge[] }>("/api/features/challenges");setItems(data.challenges); }
    catch(caught) { setError(caught instanceof Error ? caught.message : "챌린지를 불러오지 못했습니다."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{
    let active=true;
    void apiRequest<{ challenges:Challenge[] }>("/api/features/challenges")
      .then((data)=>{ if(active) setItems(data.challenges); })
      .catch((caught)=>{ if(active) setError(caught instanceof Error ? caught.message : "챌린지를 불러오지 못했습니다."); })
      .finally(()=>{ if(active) setLoading(false); });
    return ()=>{ active=false; };
  },[]);

  async function join(challengeId:string) {
    if(!authenticated) { router.push("/login?returnTo=%2Fplay%2Fchallenges");return; }
    setPendingId(challengeId);setError("");setNotice("");
    try { await apiRequest("/api/features/challenges",{ method:"POST",body:JSON.stringify({ action:"join",challengeId }) });setNotice("챌린지를 시작했습니다.");await load(); }
    catch(caught) { setError(caught instanceof Error ? caught.message : "챌린지에 참여하지 못했습니다."); }
    finally { setPendingId(""); }
  }

  async function checkIn(event:FormEvent<HTMLFormElement>,item:Challenge) {
    event.preventDefault();
    if(!item.enrollmentId||pendingId) return;
    const form=new FormData(event.currentTarget);setPendingId(item.id);setError("");setNotice("");
    try { await apiRequest("/api/features/challenges",{ method:"POST",body:JSON.stringify({ action:"checkin",enrollmentId:item.enrollmentId,note:form.get("note") }) });setNotice("오늘의 실천을 기록했습니다.");event.currentTarget.reset();await load(); }
    catch(caught) { setError(caught instanceof Error ? caught.message : "오늘의 기록을 저장하지 못했습니다."); }
    finally { setPendingId(""); }
  }

  return <section className="dadam-feature-page challenge-page">
    <header className="dadam-feature-hero"><span><Target size={25}/></span><div><small>생활 습관</small><h1>다담 챌린지</h1><p>챌린지는 누구나 둘러보고, 로그인하면 참여할 수 있어요.</p></div></header>
    {notice&&<p className="feature-notice">{notice}</p>}{error&&<p className="feature-error">{error}</p>}
    {loading ? <div className="feature-loading">챌린지를 불러오고 있어요.</div> : <div className="challenge-list">{items.map((item)=>{
      const active=item.enrollmentStatus==="active";
      const completed=item.enrollmentStatus==="completed";
      const percent=Math.min(100,Math.round(item.checkinCount/Math.max(1,item.goalDays)*100));
      return <article className={`challenge-card ${active?"active":""} ${completed?"completed":""}`} key={item.id}>
        <header><span>{item.icon||"🎯"}</span><div><small>{item.categoryName}</small><h2>{item.title}</h2></div>{completed&&<em><Check size={14}/>완료</em>}</header>
        <p>{item.description}</p>
        <div className="challenge-facts"><span><CalendarDays size={15}/>{item.periodDays}일 동안 {item.goalDays}일 실천</span><span><Users size={15}/>{item.participantCount.toLocaleString()}명 참여</span></div>
        {item.enrollmentId ? <>
          <div className="challenge-progress"><span><i style={{ width:`${percent}%` }}/></span><b>{item.checkinCount}/{item.goalDays}일</b></div>
          {active&&!item.checkedToday&&<form onSubmit={(event)=>void checkIn(event,item)}><label htmlFor={`challenge-note-${item.id}`}>오늘 실천한 내용</label><div><input id={`challenge-note-${item.id}`} name="note" minLength={10} maxLength={160} placeholder="10자 이상 적어주세요" required/><button type="submit" disabled={pendingId===item.id}>{pendingId===item.id?"저장 중":"오늘 인증"}</button></div></form>}
          {active&&item.checkedToday&&<div className="challenge-checked"><Check size={17}/>오늘 인증 완료</div>}
        </> : <button type="button" onClick={()=>void join(item.id)} disabled={pendingId===item.id}>{pendingId===item.id?"처리 중":authenticated?"챌린지 시작":"로그인하고 참여"}</button>}
      </article>;
    })}{!items.length&&<div className="feature-empty">진행 중인 챌린지가 없습니다.</div>}</div>}
  </section>;
}
