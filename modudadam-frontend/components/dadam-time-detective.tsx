"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Heart, Hourglass, LockKeyhole, Search, ShieldQuestion, Sparkles, UnlockKeyhole } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { AchievementDialog } from "@/components/achievement-dialog";

type Capsule = {
  id:string;title:string;content:string | null;visibility:"private"|"public";status:"sealed"|"opened";
  opensAt:string;openedAt:string | null;createdAt:string;canOpen:boolean;
};

export function DadamTimeCapsule() {
  const [scope,setScope]=useState<"mine"|"public">("mine");
  const [items,setItems]=useState<Capsule[]>([]);
  const [page,setPage]=useState(1); const [totalPages,setTotalPages]=useState(1);
  const [loading,setLoading]=useState(true); const [pending,setPending]=useState(false);
  const [compose,setCompose]=useState(false); const [error,setError]=useState(""); const [notice,setNotice]=useState("");
  const [opensAt,setOpensAt]=useState(() => futureLocalValue(30));
  const [selectedPresetDays,setSelectedPresetDays]=useState<number | null>(30);
  const [capsuleCelebration,setCapsuleCelebration]=useState<{ title:string;description:string } | null>(null);

  const load=useCallback(async(targetPage=page,targetScope=scope) => {
    setLoading(true); setError("");
    try { const data=await apiRequest<{ items:Capsule[];page:number;totalPages:number }>(`/api/features/time-capsules?scope=${targetScope}&page=${targetPage}`); setItems(data.items);setPage(data.page);setTotalPages(data.totalPages); }
    catch(caught) { setError(caught instanceof Error ? caught.message : "타임캡슐을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  },[page,scope]);
  useEffect(() => {
    let active=true;
    apiRequest<{ items:Capsule[];page:number;totalPages:number }>(`/api/features/time-capsules?scope=${scope}&page=${page}`)
      .then((data) => { if (active) { setItems(data.items);setPage(data.page);setTotalPages(data.totalPages); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "타임캡슐을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active=false; };
  },[page,scope]);

  function changeScope(next:"mine"|"public") { setScope(next);setPage(1);setNotice(""); }
  async function createCapsule(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    const form=new FormData(event.currentTarget); setPending(true);setError("");setNotice("");
    try {
      await apiRequest("/api/features/time-capsules",{ method:"POST",body:JSON.stringify({ title:form.get("title"),content:form.get("content"),visibility:form.get("visibility"),opensAt:new Date(opensAt).toISOString() }) });
      event.currentTarget.reset();setOpensAt(futureLocalValue(30));setSelectedPresetDays(30);setCompose(false);setScope("mine");setPage(1);setNotice("타임캡슐을 안전하게 봉인했어요.");setCapsuleCelebration({ title:"미래로 잘 보냈어요!",description:`${formatDateTime(opensAt)}까지 소중한 이야기를 안전하게 간직할게요.` });await load(1,"mine");
    } catch(caught) { setError(caught instanceof Error ? caught.message : "타임캡슐을 봉인하지 못했습니다."); }
    finally { setPending(false); }
  }
  async function openCapsule(id:string) {
    if (pending) return; setPending(true);setError("");
    try { await apiRequest("/api/features/time-capsules",{ method:"POST",body:JSON.stringify({ action:"open",id }) });setNotice("과거의 내가 보낸 타임캡슐을 열었어요.");setCapsuleCelebration({ title:"기다림이 끝났어요!",description:"과거의 내가 남겨 둔 이야기가 지금의 나에게 도착했어요." });await load(page,scope); }
    catch(caught) { setError(caught instanceof Error ? caught.message : "타임캡슐을 열지 못했습니다."); }
    finally { setPending(false); }
  }

  return <section className="dadam-feature-page time-capsule-page">
    <header className="dadam-feature-hero"><span><Hourglass size={25}/></span><div><small>DADAM TIME CAPSULE</small><h1>다담 타임캡슐</h1><p>오늘의 마음을 봉인하고, 미래의 나에게 천천히 건네보세요.</p></div></header>
    <button className="feature-primary-button" type="button" onClick={() => setCompose((value) => !value)}><LockKeyhole size={18}/>{compose ? "작성 취소" : "새 타임캡슐 봉인하기"}</button>
    {compose && <form className="feature-form capsule-form" onSubmit={createCapsule}>
      <label>캡슐 이름<input name="title" required minLength={2} maxLength={80} placeholder="미래의 나에게"/></label>
      <label>봉인할 편지<textarea name="content" required minLength={10} maxLength={4000} rows={8} placeholder="지금의 마음과 기억하고 싶은 이야기를 적어주세요."/></label>
      <fieldset><legend>언제 열어볼까요?</legend><div className="capsule-presets">{[[7,"7일"],[30,"30일"],[100,"100일"],[365,"1년"]].map(([days,label]) => <button type="button" key={days} className={selectedPresetDays===Number(days) ? "selected" : ""} aria-pressed={selectedPresetDays===Number(days)} onClick={() => { setSelectedPresetDays(Number(days));setOpensAt(futureLocalValue(Number(days))); }}>{selectedPresetDays===Number(days) && <Check size={15}/>}<span>{label}</span></button>)}</div><input type="datetime-local" value={opensAt} min={futureLocalValue(0,5)} max={futureLocalValue(3650)} onChange={(event) => { setSelectedPresetDays(null);setOpensAt(event.target.value); }} required/></fieldset>
      <fieldset><legend>개봉 후 공개 범위</legend><label className="capsule-radio"><input type="radio" name="visibility" value="private" defaultChecked/><span><strong>나만 보기</strong><small>내 보관함에서만 확인해요.</small></span></label><label className="capsule-radio"><input type="radio" name="visibility" value="public"/><span><strong>익명으로 함께 보기</strong><small>개봉한 뒤 공개 타임캡슐에 익명으로 소개돼요.</small></span></label></fieldset>
      <button type="submit" disabled={pending}>{pending ? "봉인하는 중..." : "이 날짜까지 봉인하기"}</button>
    </form>}
    <nav className="capsule-tabs" aria-label="타임캡슐 목록"><button type="button" className={scope==="mine" ? "active" : ""} onClick={() => changeScope("mine")}>내 타임캡슐</button><button type="button" className={scope==="public" ? "active" : ""} onClick={() => changeScope("public")}>익명 공개 캡슐</button></nav>
    {notice && <p className="feature-notice">{notice}</p>}{error && <p className="feature-error">{error}</p>}
    <div className="capsule-list">{loading ? <div className="feature-loading">타임캡슐 보관함을 열고 있어요.</div> : items.length ? items.map((item) => <article className={item.status==="sealed" ? "sealed" : "opened"} key={item.id}>
      <div className="capsule-status-icon">{item.status==="sealed" ? <LockKeyhole/> : <UnlockKeyhole/>}</div><div className="capsule-copy"><small>{item.status==="sealed" ? `개봉 예정 · ${formatDateTime(item.opensAt)}` : `개봉 · ${formatDateTime(item.openedAt || item.opensAt)}`}</small><h2>{item.title}</h2>{item.content ? <p>{item.content}</p> : <p className="capsule-hidden">편지는 개봉일까지 안전하게 가려져 있어요.</p>}<span>{item.visibility==="public" ? "익명 공개" : "나만 보기"}</span></div>{item.canOpen && <button type="button" disabled={pending} onClick={() => void openCapsule(item.id)}>지금 개봉</button>}
    </article>) : <div className="feature-empty">{scope==="mine" ? "아직 봉인한 타임캡슐이 없어요." : "아직 공개된 타임캡슐이 없어요."}</div>}</div>
    <Pagination page={page} totalPages={totalPages} onChange={setPage}/>
    <AchievementDialog open={Boolean(capsuleCelebration)} eyebrow="TIME CAPSULE" title={capsuleCelebration?.title || ""} description={capsuleCelebration?.description || ""} confirmLabel="보관함 확인하기" onConfirm={() => setCapsuleCelebration(null)} />
  </section>;
}

type DetectiveGame = {
  case:{ caseNo:number;title:string;briefing:string;question:string;difficulty:number };
  suspects:Array<{ id:string;name:string;statement:string;selected:boolean }>;
  hints:Array<{ order:number;content:string }>;
  livesRemaining:number;hintsRevealed:number;status:"active"|"solved"|"failed";reward:number;walletBalance:number;
  explanation:string | null;correctName:string | null;
};

export function DadamDetectiveRoom() {
  const [game,setGame]=useState<DetectiveGame | null>(null); const [selected,setSelected]=useState<string | null>(null);
  const [loading,setLoading]=useState(true);const [pending,setPending]=useState(false);const [error,setError]=useState("");const [feedback,setFeedback]=useState("");
  const [detectiveCelebration,setDetectiveCelebration]=useState<{ title:string;description:string;reward:string } | null>(null);
  const load=useCallback(async() => { setLoading(true);setError("");try { setGame(await apiRequest<DetectiveGame>("/api/features/detective")); } catch(caught) { setError(caught instanceof Error ? caught.message : "오늘의 사건을 불러오지 못했습니다."); } finally { setLoading(false); } },[]);
  useEffect(() => {
    let active=true;
    apiRequest<DetectiveGame>("/api/features/detective")
      .then((data) => { if (active) setGame(data); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "오늘의 사건을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active=false; };
  },[]);
  const selectedSuspect=useMemo(() => game?.suspects.find((suspect) => suspect.id===selected) || null,[game,selected]);
  async function accuse() {
    if (!selected || pending || !game || game.status!=="active") return;setPending(true);setError("");
    try {
      const result=await apiRequest<{ correct:boolean;status:string;livesRemaining:number;newHint:string|null;reward:number }>("/api/features/detective",{ method:"POST",body:JSON.stringify({ suspectId:selected }) });
      setFeedback(result.correct ? `정답입니다! 도토리 ${result.reward}개를 받았어요.` : result.status==="failed" ? `오늘의 수사가 종료됐어요. 도전 보상으로 도토리 ${result.reward}개를 받았어요.` : `알리바이가 성립합니다. 새로운 단서가 열렸어요.`);
      if (result.correct || result.status==="failed") setDetectiveCelebration({ title:result.correct ? "사건 해결!" : "오늘의 수사 종료",description:result.correct ? result.livesRemaining===3 ? "단 한 번에 진실을 찾아냈어요. 완벽한 추리였어요!" : `남은 목숨 ${result.livesRemaining}개로 사건의 진실을 밝혀냈어요.` : "아쉽지만 오늘의 단서를 끝까지 추적했어요. 내일 새로운 사건에서 다시 만나요.",reward:`🌰 도토리 ${result.reward.toLocaleString()}개 획득` });
      setSelected(null);await load();
    } catch(caught) { setError(caught instanceof Error ? caught.message : "수사 결론을 확인하지 못했습니다."); }
    finally { setPending(false); }
  }
  return <section className="dadam-feature-page detective-page">
    <header className="dadam-feature-hero"><span><ShieldQuestion size={25}/></span><div><small>DADAM DETECTIVE ROOM</small><h1>다담 추리방</h1><p>기록을 교차해 거짓말한 한 사람을 찾아보세요.</p></div></header>
    {loading && !game ? <div className="feature-loading">오늘의 사건 파일을 정리하고 있어요.</div> : error && !game ? <div className="feature-empty">{error}<button type="button" onClick={() => void load()}>다시 불러오기</button></div> : game && <>
      <div className="detective-resource"><span><small>남은 목숨</small><strong aria-label={`목숨 ${game.livesRemaining}개`}>{[0,1,2].map((index) => <Heart key={index} className={index<game.livesRemaining ? "alive" : "lost"}/>)}</strong></span><span><small>열린 단서</small><strong>{game.hintsRevealed} / 3 🌰</strong></span><span><small>보유 도토리</small><strong>{game.walletBalance.toLocaleString()}개</strong></span></div>
      <article className="detective-case"><header><span>CASE {String(game.case.caseNo).padStart(3,"0")}</span><b>{"★".repeat(game.case.difficulty)}</b></header><h2>{game.case.title}</h2><p>{game.case.briefing}</p><strong><Search size={18}/>{game.case.question}</strong></article>
      {game.hints.length>0 && <section className="detective-hints"><h2>수사 단서</h2>{game.hints.map((hint) => <p key={hint.order}><span>🌰 단서 {hint.order}</span>{hint.content}</p>)}</section>}
      {feedback && <p className="feature-notice">{feedback}</p>}{error && <p className="feature-error">{error}</p>}
      {game.status!=="active" && <article className={`detective-result ${game.status}`}><Sparkles/><small>{game.status==="solved" ? "사건 해결" : "오늘의 수사 종료"}</small><h2>정답 · {game.correctName}</h2><p>{game.explanation}</p><strong>오늘 받은 도토리 {game.reward}개</strong><span>내일 새로운 사건이 열려요.</span></article>}
      <section className="detective-suspects"><h2>수사 결론 10개</h2><p>사건의 모든 단서를 만족하는 기록은 하나뿐이에요. 한 번 선택하면 되돌릴 수 없습니다.</p><div>{game.suspects.map((suspect,index) => <button type="button" key={suspect.id} disabled={suspect.selected || game.status!=="active" || pending} className={`${selected===suspect.id ? "selected" : ""} ${suspect.selected ? "eliminated" : ""}`} onClick={() => setSelected(suspect.id)}><span>{index+1}</span><div><strong>{suspect.name}</strong><p>{suspect.statement}</p></div>{suspect.selected && <em>확인 완료</em>}</button>)}</div></section>
      {game.status==="active" && <div className="detective-accuse"><span>{selectedSuspect ? `${selectedSuspect.name}을(를) 선택할까요?` : "수사 결론 하나를 선택해 주세요."}</span><button type="button" disabled={!selectedSuspect || pending} onClick={() => void accuse()}>{pending ? "기록 확인 중..." : "이 결론 선택하기"}</button></div>}
      <AchievementDialog open={Boolean(detectiveCelebration)} eyebrow="CASE CLOSED" title={detectiveCelebration?.title || ""} description={detectiveCelebration?.description || ""} reward={detectiveCelebration?.reward} confirmLabel="사건 기록 확인하기" onConfirm={() => setDetectiveCelebration(null)} />
    </>}
  </section>;
}

function Pagination({ page,totalPages,onChange }:{ page:number;totalPages:number;onChange:(page:number)=>void }) {
  if (totalPages<=1) return null;
  return <nav className="feature-pagination" aria-label="페이지 이동"><button type="button" disabled={page<=1} onClick={() => onChange(page-1)}><ChevronLeft/></button><span>{page} / {totalPages}</span><button type="button" disabled={page>=totalPages} onClick={() => onChange(page+1)}><ChevronRight/></button></nav>;
}
function futureLocalValue(days:number,minutes=0) { const date=new Date(Date.now()+days*86_400_000+minutes*60_000);date.setSeconds(0,0);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`; }
function formatDateTime(value:string) { return new Date(value).toLocaleString("ko-KR",{ year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit" }); }
