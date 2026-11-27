"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, ChevronDown, Target, Users } from "lucide-react";
import { apiRequest } from "@/lib/api";

type VerificationType="duration"|"quantity"|"duration_choice"|"two_text"|"reading"|"reflection";
type VerificationConfig={
  amountLabel?:string;unit?:string;min?:number;max?:number;
  detailLabel?:string;detailRequired?:boolean;detailMin?:number;
  choiceLabel?:string;options?:string[];
  subjectLabel?:string;resultLabel?:string;subjectMin?:number;resultMin?:number;
};
type Challenge={
  id:string;title:string;description:string;icon:string;categoryName:string;goalDays:number;periodDays:number;
  verificationType:VerificationType;verificationConfig:VerificationConfig;
  participantCount:number;enrollmentId:string|null;enrollmentStatus:string|null;roundNo:number|null;
  checkinCount:number;checkedToday:boolean;
};
type CheckinResponse={ reward:number;completed:boolean;checkinCount:number };

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
    try {
      await apiRequest("/api/features/challenges",{ method:"POST",body:JSON.stringify({ action:"join",challengeId }) });
      setNotice("챌린지를 시작했습니다.");
      await load();
    } catch(caught) { setError(caught instanceof Error ? caught.message : "챌린지에 참여하지 못했습니다."); }
    finally { setPendingId(""); }
  }

  async function checkIn(event:FormEvent<HTMLFormElement>,item:Challenge) {
    event.preventDefault();
    if(!item.enrollmentId||pendingId) return;
    const formElement=event.currentTarget;
    const form=new FormData(formElement);
    const amountValue=String(form.get("amount") || "").trim();
    const evidence={
      amount:amountValue ? Number(amountValue) : undefined,
      choice:String(form.get("choice") || ""),
      subject:String(form.get("subject") || ""),
      detail:String(form.get("detail") || ""),
    };
    setPendingId(item.id);setError("");setNotice("");
    try {
      const result=await apiRequest<CheckinResponse>("/api/features/challenges",{
        method:"POST",body:JSON.stringify({ action:"checkin",enrollmentId:item.enrollmentId,evidence }),
      });
      formElement.reset();
      setNotice(result.completed
        ? `챌린지를 완료했습니다.${result.reward > 0 ? ` 도토리 ${result.reward}개를 받았습니다.` : ""}`
        : "오늘의 실천을 기록했습니다.");
      await load();
    } catch(caught) { setError(caught instanceof Error ? caught.message : "오늘의 기록을 저장하지 못했습니다."); }
    finally { setPendingId(""); }
  }

  return <section className="dadam-feature-page challenge-page">
    <header className="dadam-feature-hero"><span><Target size={25}/></span><div><small>생활 습관</small><h1>다담 챌린지</h1><p>작은 실천을 기록하고 꾸준한 변화를 확인해 보세요.</p></div></header>
    {notice&&<p className="feature-notice">{notice}</p>}{error&&<p className="feature-error">{error}</p>}
    {loading ? <div className="feature-loading">챌린지를 불러오고 있어요.</div> : <div className="challenge-list">{items.map((item)=>{
      const active=item.enrollmentStatus==="active";
      const completed=item.enrollmentStatus==="completed";
      const expired=item.enrollmentStatus==="expired";
      const percent=Math.min(100,Math.round(item.checkinCount/Math.max(1,item.goalDays)*100));
      return <article className={`challenge-card ${active?"active":""} ${completed?"completed":""}`} key={item.id}>
        <header><span>{item.icon||"🎯"}</span><div><small>{item.categoryName}</small><h2>{item.title}</h2></div>{completed&&<em><Check size={14}/>완료</em>}{expired&&<em className="expired">기간 종료</em>}</header>
        <p>{item.description}</p>
        <div className="challenge-facts"><span><CalendarDays size={15}/>{item.periodDays}일 동안 {item.goalDays}일 실천</span><span><Users size={15}/>{item.participantCount.toLocaleString()}명 참여</span></div>
        {item.enrollmentId&&<div className="challenge-progress"><span><i style={{ width:`${percent}%` }}/></span><b>{item.checkinCount}/{item.goalDays}일</b></div>}
        {active&&!item.checkedToday&&<ChallengeCheckinForm item={item} pending={pendingId===item.id} onSubmit={checkIn}/>}
        {active&&item.checkedToday&&<div className="challenge-checked"><Check size={17}/>오늘 인증 완료</div>}
        {!active&&<button type="button" onClick={()=>void join(item.id)} disabled={pendingId===item.id}>{pendingId===item.id?"처리 중":item.enrollmentId?"다시 도전":authenticated?"챌린지 시작":"로그인하고 참여"}</button>}
      </article>;
    })}{!items.length&&<div className="feature-empty">진행 중인 챌린지가 없습니다.</div>}</div>}
  </section>;
}

function ChallengeCheckinForm({ item,pending,onSubmit }:{
  item:Challenge;pending:boolean;onSubmit:(event:FormEvent<HTMLFormElement>,item:Challenge)=>Promise<void>;
}) {
  const config=item.verificationConfig || {};
  const needsAmount=["duration","quantity","duration_choice","reading"].includes(item.verificationType);
  const needsChoice=item.verificationType==="duration_choice";
  const needsSubject=item.verificationType==="two_text";
  const showDetail=Boolean(config.detailLabel)||item.verificationType==="reflection"||item.verificationType==="two_text";
  const detailRequired=Boolean(config.detailRequired)||item.verificationType==="reading"||item.verificationType==="reflection"||item.verificationType==="two_text";
  const fieldId=(name:string)=>`challenge-${name}-${item.id}`;
  return <form className="challenge-checkin-form" onSubmit={(event)=>void onSubmit(event,item)}>
    <strong>오늘의 실천 확인</strong>
    <div className="challenge-checkin-fields">
      {needsAmount&&<label className="challenge-checkin-field" htmlFor={fieldId("amount")}><span>{config.amountLabel||"실천량"}</span><span className="challenge-number-input"><input id={fieldId("amount")} name="amount" type="number" inputMode="numeric" min={config.min||1} max={config.max||9999} placeholder={String(config.min||1)} required/><i>{config.unit||""}</i></span></label>}
      {needsChoice&&<label className="challenge-checkin-field" htmlFor={fieldId("choice")}><span>{config.choiceLabel||"활동"}</span><span className="challenge-select"><select id={fieldId("choice")} name="choice" defaultValue="" required><option value="" disabled>선택해 주세요</option>{(config.options||[]).map((option)=><option value={option} key={option}>{option}</option>)}</select><ChevronDown size={17}/></span></label>}
      {needsSubject&&<label className="challenge-checkin-field" htmlFor={fieldId("subject")}><span>{config.subjectLabel||"실천 대상"}</span><input id={fieldId("subject")} name="subject" minLength={config.subjectMin||2} maxLength={80} placeholder="구체적으로 적어주세요" required/></label>}
      {showDetail&&<label className="challenge-checkin-field challenge-detail-field" htmlFor={fieldId("detail")}><span>{config.resultLabel||config.detailLabel||"오늘 실천한 내용"}{!detailRequired&&<small>선택</small>}</span><textarea id={fieldId("detail")} name="detail" minLength={detailRequired?(config.resultMin||config.detailMin||(item.verificationType==="reflection"?10:5)):undefined} maxLength={160} placeholder={detailRequired?"실제 실천한 내용을 적어주세요":"간단한 기록을 남겨보세요"} required={detailRequired}/></label>}
    </div>
    <p>입력한 내용은 오늘의 진행 기록으로 저장됩니다.</p>
    <button className="challenge-checkin-submit" type="submit" disabled={pending}>{pending?"저장 중":"오늘 인증"}</button>
  </form>;
}
