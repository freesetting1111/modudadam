"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Heart, Hourglass, Lightbulb, LockKeyhole, Search, ShieldQuestion, Sparkles, Trophy, UnlockKeyhole } from "lucide-react";
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
    <header className="dadam-feature-hero"><span><Hourglass size={25}/></span><div><small>예약 편지</small><h1>다담 타임캡슐</h1><p>정한 날짜까지 편지를 보관해요.</p></div></header>
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
    <AchievementDialog open={Boolean(capsuleCelebration)} eyebrow="타임캡슐" title={capsuleCelebration?.title || ""} description={capsuleCelebration?.description || ""} confirmLabel="보관함 보기" onConfirm={() => setCapsuleCelebration(null)} />
  </section>;
}

type DetectiveGame = {
  case:{ title:string;briefing:string;question:string;difficulty:number };
  suspects:Array<{ id:string;statement:string;selected:boolean }>;
  hints:Array<{ order:number;content:string }>;
  playOn:string;
  livesRemaining:number;hintsRevealed:number;hintsRemaining:number;status:"active"|"solved"|"failed";reward:number;rewardPreview:number;walletBalance:number;
  explanation:string | null;
};

export function DadamDetectiveRoom() {
  const initialLoadStarted=useRef(false);
  const [game,setGame]=useState<DetectiveGame | null>(null); const [selected,setSelected]=useState<string | null>(null);
  const [loading,setLoading]=useState(true);const [pending,setPending]=useState(false);const [error,setError]=useState("");const [feedback,setFeedback]=useState("");
  const [detectiveCelebration,setDetectiveCelebration]=useState<{ title:string;description:string;reward:string } | null>(null);
  const [hintPopup,setHintPopup]=useState<{ order:number;content:string;hintsRemaining:number } | null>(null);
  const load=useCallback(async(reshuffle=false) => { setLoading(true);setError("");try { setGame(await apiRequest<DetectiveGame>(`/api/features/detective${reshuffle ? "?reshuffle=1" : ""}`)); } catch(caught) { setError(caught instanceof Error ? caught.message : "오늘의 사건을 불러오지 못했습니다."); } finally { setLoading(false); } },[]);
  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current=true;
    void load(true);
  },[load]);
  useEffect(() => {
    if (!game?.playOn) return;
    const refreshForNewDay=() => {
      if (currentKstDate()===game.playOn) return;
      setSelected(null);setFeedback("");setDetectiveCelebration(null);setHintPopup(null);
      void load(true);
    };
    const interval=window.setInterval(refreshForNewDay,60_000);
    const handleVisibility=() => { if (document.visibilityState==="visible") refreshForNewDay(); };
    window.addEventListener("focus",refreshForNewDay);
    document.addEventListener("visibilitychange",handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus",refreshForNewDay);
      document.removeEventListener("visibilitychange",handleVisibility);
    };
  },[game?.playOn,load]);
  const selectedSuspect=useMemo(() => game?.suspects.find((suspect) => suspect.id===selected) || null,[game,selected]);
  const selectedCandidateNumber=useMemo(() => selected && game ? game.suspects.findIndex((suspect) => suspect.id===selected)+1 : 0,[game,selected]);
  async function accuse() {
    if (!selected || pending || !game || game.status!=="active") return;setPending(true);setError("");
    try {
      const result=await apiRequest<{ correct:boolean;status:string;livesRemaining:number;reward:number;rewardPreview:number }>("/api/features/detective",{ method:"POST",body:JSON.stringify({ suspectId:selected }) });
      setFeedback(result.correct ? `정답입니다! 도토리 ${result.reward}개를 받았어요.` : result.status==="failed" ? `목숨을 모두 사용했어요. 도전 보상으로 도토리 ${result.reward}개를 받았어요.` : `오답입니다. 목숨 1개가 소모됐어요. 지금 해결하면 도토리 ${result.rewardPreview}개를 받을 수 있어요.`);
      if (result.correct || result.status==="failed") setDetectiveCelebration({ title:result.correct ? "사건 해결!" : "오늘의 수사 종료",description:result.correct ? result.livesRemaining===3 ? "단 한 번에 진실을 찾아냈어요. 완벽한 추리였어요!" : `남은 목숨 ${result.livesRemaining}개로 사건의 진실을 밝혀냈어요.` : "아쉽지만 오늘의 단서를 끝까지 추적했어요. 내일 새로운 사건에서 다시 만나요.",reward:`🌰 도토리 ${result.reward.toLocaleString()}개 획득` });
      setSelected(null);await load();
    } catch(caught) { setError(caught instanceof Error ? caught.message : "수사 결론을 확인하지 못했습니다."); }
    finally { setPending(false); }
  }
  async function revealHint() {
    if (pending || !game || game.status!=="active" || game.hintsRevealed>=3) return;
    setPending(true);setError("");
    try { const hint=await apiRequest<{ order:number;content:string;hintsRemaining:number }>("/api/features/detective",{ method:"POST",body:JSON.stringify({ action:"reveal_hint" }) });setHintPopup(hint);await load(); }
    catch(caught) { setError(caught instanceof Error ? caught.message : "단서를 확인하지 못했습니다."); }
    finally { setPending(false); }
  }
  return <section className="dadam-feature-page detective-page">
    <header className="dadam-feature-hero"><span><ShieldQuestion size={25}/></span><div><small>오늘의 사건</small><h1>다담 추리방</h1><p>단서를 확인하고 정답을 고르세요.</p></div></header>
    {loading && !game ? <div className="feature-loading">오늘의 사건 파일을 정리하고 있어요.</div> : error && !game ? <div className="feature-empty">{error}<button type="button" onClick={() => void load()}>다시 불러오기</button></div> : game && <>
      <div className="detective-resource"><span className="lives"><small>남은 목숨</small><strong aria-label={`목숨 ${game.livesRemaining}개`}>{[0,1,2].map((index) => <Heart key={index} className={index<game.livesRemaining ? "alive" : "lost"}/>)}</strong></span><span className="clues"><small>사용 가능한 단서</small><strong>🌰 {game.hintsRemaining}개</strong></span><span className="reward"><small>{game.status==="active" ? "지금 해결 보상" : "획득한 보상"}</small><strong>🌰 {game.status==="active" ? game.rewardPreview : game.reward}개</strong></span></div>
      <aside className="detective-reward-guide" aria-label="목숨별 도토리 보상"><header><Trophy size={17}/><div><strong>목숨별 보상</strong></div></header><div>{[[3,5],[2,3],[1,2],[0,1]].map(([lives,reward]) => <span className={game.status==="active" && game.livesRemaining===lives ? "current" : ""} key={lives}><i>{lives ? `${"♥".repeat(lives)} 목숨 ${lives}` : "목숨 소진"}</i><b>🌰 {reward}개</b></span>)}</div><p>단서는 도토리를 차감하지 않습니다.</p></aside>
      <article className="detective-case"><header><span>오늘의 사건</span><b aria-label={`난이도 ${game.case.difficulty}단계`}>{"★".repeat(game.case.difficulty)}</b></header><h2>{game.case.title}</h2><DetectiveBriefing text={game.case.briefing}/><div className="detective-question"><span><Search size={19}/></span><div><small>최종 질문</small><strong>{game.case.question}</strong></div></div></article>
      <section className="detective-hints"><header><div><h2><Lightbulb size={18}/> 단서 <em>{game.hintsRemaining}개 남음</em></h2></div>{game.status==="active" && game.hintsRevealed<3 && <button type="button" disabled={pending} onClick={() => void revealHint()}>단서 확인</button>}</header>{game.hints.length ? game.hints.map((hint) => <p key={hint.order}><span>단서 {hint.order}</span>{hint.content}</p>) : <div className="detective-hint-empty"><Lightbulb size={20}/><strong>사용한 단서가 없습니다.</strong></div>}</section>
      {feedback && <p className="feature-notice">{feedback}</p>}{error && <p className="feature-error">{error}</p>}
      {game.status!=="active" && <article className={`detective-result ${game.status}`}><Sparkles/><small>{game.status==="solved" ? "사건 해결" : "오늘의 수사 종료"}</small><h2>정답 결론</h2><p>{game.explanation}</p><strong>오늘 받은 도토리 {game.reward}개</strong><span>내일 새로운 사건이 열려요.</span></article>}
      <section className="detective-suspects"><header><div><small>STEP 3</small><h2>수사 결론 선택</h2><p>입장할 때마다 후보 순서가 바뀝니다. 번호가 아닌 내용을 확인해 주세요.</p></div><b>10개 후보</b></header><div>{game.suspects.map((suspect,index) => <button type="button" key={suspect.id} disabled={suspect.selected || game.status!=="active" || pending} className={`${selected===suspect.id ? "selected" : ""} ${suspect.selected ? "eliminated" : ""}`} onClick={() => setSelected(suspect.id)}><span>{index+1}</span><div><strong>결론 후보 {index+1}</strong><SuspectStatement text={suspect.statement}/></div>{suspect.selected && <em>확인 완료</em>}{selected===suspect.id && !suspect.selected && <em className="choice-ready"><Check size={12}/>선택됨</em>}</button>)}</div></section>
      {game.status==="active" && <div className="detective-accuse"><span>{selectedSuspect ? `결론 후보 ${selectedCandidateNumber}을 선택할까요?` : "수사 결론 하나를 선택해 주세요."}</span><button type="button" disabled={!selectedSuspect || pending} onClick={() => void accuse()}>{pending ? "기록 확인 중..." : "이 결론 선택하기"}</button></div>}
      <AchievementDialog open={Boolean(detectiveCelebration)} eyebrow="수사 종료" title={detectiveCelebration?.title || ""} description={detectiveCelebration?.description || ""} reward={detectiveCelebration?.reward} confirmLabel="기록 보기" onConfirm={() => setDetectiveCelebration(null)} />
      <AchievementDialog open={Boolean(hintPopup)} eyebrow={`단서 ${hintPopup?.order || ""}`} title="단서를 확인했어요" description={hintPopup?.content || ""} reward={`남은 단서 ${hintPopup?.hintsRemaining ?? 0}개`} confirmLabel="확인" onConfirm={() => setHintPopup(null)} />
    </>}
  </section>;
}

function DetectiveBriefing({ text }:{ text:string }) {
  const parts=text.split(/\s+(?=\d+\.\s*)/).map((part)=>part.trim()).filter(Boolean);
  const intro=parts[0] && !/^\d+\./.test(parts[0]) ? parts.shift() : null;
  return <div className="detective-briefing">{intro && <section className="detective-summary"><small>STEP 1 · 사건 개요</small><p>{intro}</p></section>}{parts.length>0 && <section className="detective-records"><header><div><small>STEP 2</small><h3>조사 기록</h3></div><span>{parts.length}개</span></header><ol>{parts.map((part,index)=><li key={index}><span>{index+1}.</span><p>{part.replace(/^\d+\.\s*/,"")}</p></li>)}</ol></section>}</div>;
}

function SuspectStatement({ text }:{ text:string }) {
  const facts=text.split(/\s*·\s*/).map((part)=>part.trim()).filter(Boolean);
  return <dl className="detective-facts">{facts.map((fact,index)=>{const separator=fact.indexOf(":");const label=separator>0?fact.slice(0,separator).trim():`정보 ${index+1}`;const value=separator>0?fact.slice(separator+1).trim():fact;return <div key={`${label}-${index}`}><dt>{label}</dt><dd>{value}</dd></div>;})}</dl>;
}

function Pagination({ page,totalPages,onChange }:{ page:number;totalPages:number;onChange:(page:number)=>void }) {
  if (totalPages<=1) return null;
  return <nav className="feature-pagination" aria-label="페이지 이동"><button type="button" disabled={page<=1} onClick={() => onChange(page-1)}><ChevronLeft/></button><span>{page} / {totalPages}</span><button type="button" disabled={page>=totalPages} onClick={() => onChange(page+1)}><ChevronRight/></button></nav>;
}
function futureLocalValue(days:number,minutes=0) { const date=new Date(Date.now()+days*86_400_000+minutes*60_000);date.setSeconds(0,0);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`; }
function formatDateTime(value:string) { return new Date(value).toLocaleString("ko-KR",{ year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit" }); }
function currentKstDate() { const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{ timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).formatToParts(new Date()).map(({ type,value }) => [type,value]));return `${parts.year}-${parts.month}-${parts.day}`; }
