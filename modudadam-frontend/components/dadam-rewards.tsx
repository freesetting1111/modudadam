"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, Check, ChevronLeft, ChevronRight, Coins, Gift, Trophy } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";

function useLoginRedirect() {
  const router = useRouter();
  return useCallback((error:unknown) => {
    if (error instanceof ApiError && error.status === 401) { router.push(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`); return true; }
    return false;
  },[router]);
}

type AttendanceData = {
  month:string;today:string;todayChecked:boolean;streak:number;
  wallet:{ balance:number;lifetimeEarned:number;lifetimeSpent:number };
  checkins:Array<{ attendanceOn:string;stampCode:string;emoji:string;acornsEarned:number }>;
  stamps:Array<{ code:string;name:string;emoji:string;description:string;price:number;owned:boolean;equipped:boolean }>;
};

export function DadamAttendance() {
  const redirectLogin = useLoginRedirect(); const [data,setData] = useState<AttendanceData | null>(null); const [month,setMonth] = useState(""); const [loading,setLoading] = useState(true); const [pending,setPending] = useState(""); const [notice,setNotice] = useState("");
  const load = useCallback((targetMonth?:string) => apiRequest<AttendanceData>(`/api/features/attendance${targetMonth ? `?month=${targetMonth}` : ""}`).then((result) => { setData(result); setMonth(result.month); }).catch((error) => { if (!redirectLogin(error)) setNotice(error instanceof Error ? error.message : "출석부를 불러오지 못했습니다."); }).finally(() => setLoading(false)),[redirectLogin]);
  useEffect(() => { void load(); },[load]);
  async function action(actionName:string,stampCode?:string) { setPending(`${actionName}:${stampCode || ""}`); setNotice(""); try { const result = await apiRequest<{ reward?:number;bonus?:number }>("/api/features/attendance",{ method:"POST",body:JSON.stringify({ action:actionName,stampCode }) }); setNotice(actionName === "attend" ? `출석 완료! 도토리 ${result.reward || 1}개를 받았어요.${result.bonus ? ` 연속 출석 보너스 ${result.bonus}개가 포함됐어요.` : ""}` : actionName === "purchase" ? "새 스탬프를 해금했어요." : "대표 스탬프를 변경했어요."); await load(month); } catch(error) { if (!redirectLogin(error)) setNotice(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); } finally { setPending(""); } }
  function moveMonth(offset:number) { if (!month) return; const [year,value] = month.split("-").map(Number); const date = new Date(Date.UTC(year,value - 1 + offset,1)); const next = `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`; setLoading(true); void load(next); }
  const calendar = data ? buildCalendar(data.month,data.checkins) : [];
  return <section className="dadam-feature-page attendance-page">
    <header className="reward-hero"><span><CalendarCheck2 size={27}/></span><div><small>DAILY ATTENDANCE</small><h1>다담 출석부</h1><p>하루 한 번 스탬프를 찍고 도토리를 차곡차곡 모아보세요.</p></div></header>
    {loading || !data ? <div className="feature-loading">출석부를 펼치고 있어요.</div> : <>
      <article className="acorn-wallet"><div><span>🌰</span><p><small>보유 도토리</small><strong>{data.wallet.balance.toLocaleString()}개</strong></p></div><dl><div><dt>연속 출석</dt><dd>{data.streak}일</dd></div><div><dt>모은 도토리</dt><dd>{data.wallet.lifetimeEarned.toLocaleString()}개</dd></div></dl></article>
      <button className="attendance-button" type="button" disabled={data.todayChecked || pending.startsWith("attend")} onClick={() => void action("attend")}><CalendarCheck2 size={20}/>{data.todayChecked ? "오늘 출석 완료" : pending ? "스탬프 찍는 중..." : "오늘의 출석 스탬프 찍기"}</button>
      <article className="attendance-calendar"><header><button type="button" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft/></button><strong>{Number(month.slice(0,4))}년 {Number(month.slice(5))}월</strong><button type="button" onClick={() => moveMonth(1)} disabled={month >= data.today.slice(0,7)} aria-label="다음 달"><ChevronRight/></button></header><div className="calendar-week">{["일","월","화","수","목","금","토"].map((day) => <span key={day}>{day}</span>)}</div><div className="attendance-days">{calendar.map((item,index) => item ? <div className={item.date === data.today ? "today" : ""} key={item.date}><small>{item.day}</small>{item.checkin ? <span title={`도토리 ${item.checkin.acornsEarned}개`}>{item.checkin.emoji}</span> : <i/>}</div> : <div key={`blank-${index}`}/>)}</div></article>
      <section className="stamp-shop"><header><div><small>ACORN STAMP SHOP</small><h2>도토리 스탬프 상점</h2><p>해금한 스탬프는 다음 출석부터 사용할 수 있어요.</p></div><Gift size={25}/></header><div>{data.stamps.map((stamp) => <article className={stamp.equipped ? "equipped" : ""} key={stamp.code}><span>{stamp.emoji}</span><div><strong>{stamp.name}</strong><p>{stamp.description}</p></div>{stamp.equipped ? <button disabled><Check size={15}/>사용 중</button> : stamp.owned ? <button type="button" disabled={Boolean(pending)} onClick={() => void action("equip",stamp.code)}>사용하기</button> : <button type="button" disabled={Boolean(pending) || data.wallet.balance < stamp.price} onClick={() => void action("purchase",stamp.code)}>🌰 {stamp.price}</button>}</article>)}</div></section>
    </>}
    {notice && <p className="reward-notice">{notice}</p>}
  </section>;
}

type Challenge = { id:string;title:string;description:string;icon:string;categoryName:string;goalDays:number;periodDays:number;dailyAcorns:number;completionAcorns:number;participantCount:number;enrollmentId:string|null;startedOn:string|null;endsOn:string|null;enrollmentStatus:"active"|"completed"|"expired"|null;checkinCount:number;checkedToday:boolean };

export function DadamChallenges() {
  const redirectLogin = useLoginRedirect(); const [items,setItems] = useState<Challenge[]>([]); const [wallet,setWallet] = useState(0); const [loading,setLoading] = useState(true); const [pending,setPending] = useState(""); const [notice,setNotice] = useState("");
  const load = useCallback(() => apiRequest<{ challenges:Challenge[];walletBalance:number }>("/api/features/challenges").then((data) => { setItems(data.challenges); setWallet(data.walletBalance); }).catch((error) => setNotice(error instanceof Error ? error.message : "챌린지를 불러오지 못했습니다.")).finally(() => setLoading(false)),[]);
  useEffect(() => { void load(); },[load]);
  async function action(actionName:"join"|"checkin",item:Challenge) { setPending(item.id); setNotice(""); try { const result = await apiRequest<{ reward?:number;completed?:boolean }>("/api/features/challenges",{ method:"POST",body:JSON.stringify({ action:actionName,challengeId:item.id,enrollmentId:item.enrollmentId }) }); setNotice(actionName === "join" ? "챌린지를 시작했어요. 오늘부터 한 걸음씩 함께해요." : result.completed ? `챌린지 완료! 도토리 ${result.reward}개를 받았어요.` : `오늘의 인증 완료! 도토리 ${result.reward}개를 받았어요.`); await load(); } catch(error) { if (!redirectLogin(error)) setNotice(error instanceof Error ? error.message : "요청을 처리하지 못했습니다."); } finally { setPending(""); } }
  return <section className="dadam-feature-page challenge-page">
    <header className="reward-hero challenge"><span><Trophy size={27}/></span><div><small>DADAM CHALLENGE</small><h1>다담 챌린지</h1><p>거창한 목표보다 오늘의 작은 실천을 함께 이어가요.</p></div></header>
    <div className="challenge-wallet"><Coins size={20}/><span>나의 도토리</span><strong>{wallet.toLocaleString()}개</strong></div>
    {loading ? <div className="feature-loading">함께할 챌린지를 찾고 있어요.</div> : <div className="challenge-list">{items.map((item) => { const percent=Math.min(100,Math.round(item.checkinCount/item.goalDays*100)); return <article key={item.id} className={item.enrollmentStatus || ""}><header><span>{item.icon}</span><div><small>{item.categoryName}</small><h2>{item.title}</h2></div></header><p>{item.description}</p><div className="challenge-meta"><span>{item.goalDays}회 달성 · {item.periodDays}일 동안</span><span>완료 보상 🌰 {item.completionAcorns}</span></div>{item.enrollmentId && <div className="challenge-progress"><div><span>나의 진행</span><strong>{item.checkinCount} / {item.goalDays}</strong></div><i><b style={{ width:`${percent}%` }}/></i>{item.endsOn && <small>{item.enrollmentStatus === "completed" ? "챌린지를 완료했어요!" : `${formatKoreanDate(item.endsOn)}까지`}</small>}</div>}<footer><span>{item.participantCount.toLocaleString()}명 참여</span>{!item.enrollmentId ? <button type="button" disabled={pending === item.id} onClick={() => void action("join",item)}>참여하기</button> : item.enrollmentStatus === "completed" ? <button disabled><Check size={16}/>완료</button> : item.enrollmentStatus === "expired" ? <button disabled>기간 종료</button> : <button type="button" disabled={item.checkedToday || pending === item.id} onClick={() => void action("checkin",item)}>{item.checkedToday ? "오늘 인증 완료" : pending === item.id ? "인증 중..." : `오늘 인증 · 🌰 ${item.dailyAcorns}`}</button>}</footer></article>; })}</div>}
    {notice && <p className="reward-notice">{notice}</p>}
  </section>;
}

function buildCalendar(month:string,checkins:AttendanceData["checkins"]) { const [year,value] = month.split("-").map(Number); const firstDay = new Date(Date.UTC(year,value-1,1)).getUTCDay(); const days = new Date(Date.UTC(year,value,0)).getUTCDate(); const byDate = new Map(checkins.map((item) => [item.attendanceOn,item])); return [...Array(firstDay).fill(null),...Array.from({ length:days },(_,index) => { const day=index+1; const date=`${month}-${String(day).padStart(2,"0")}`; return { day,date,checkin:byDate.get(date) || null }; })]; }
function formatKoreanDate(value:string) { const [,month,day] = value.split("-"); return `${Number(month)}월 ${Number(day)}일`; }
