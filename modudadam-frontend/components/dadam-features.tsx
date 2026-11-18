"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Compass, LocateFixed, Mail, MapPin, MessageCircle, RefreshCw, Send, Sparkles, Vote } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { categories } from "@/lib/categories";

function FeatureHero({ icon: Icon, eyebrow, title, description }: { icon: typeof Vote; eyebrow: string; title: string; description: string }) {
  return <header className="dadam-feature-hero"><span><Icon size={25}/></span><div><small>{eyebrow}</small><h1>{title}</h1><p>{description}</p></div></header>;
}

function useLoginRedirect() {
  const router = useRouter();
  return (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return true;
    }
    return false;
  };
}

type Choice = { id: string; question: string; description: string | null; activeOn: string; myOptionId: string | null; options: Array<{ id: string; label: string; emoji: string | null; voteCount: number }> };

export function TodayChoice() {
  const redirectLogin = useLoginRedirect();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = () => apiRequest<{ choice: Choice | null }>("/api/features/choices").then((data) => setChoice(data.choice)).catch((caught) => setError(caught instanceof Error ? caught.message : "오늘의 선택을 불러오지 못했습니다.")).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);
  const total = choice?.options.reduce((sum, option) => sum + option.voteCount, 0) || 0;

  async function voteFor(optionId: string) {
    if (!choice || pending) return;
    setPending(true); setError("");
    try {
      await apiRequest("/api/features/choices", { method: "POST", body: JSON.stringify({ choiceId: choice.id, optionId }) });
      await load();
    } catch (caught) {
      if (!redirectLogin(caught)) setError(caught instanceof Error ? caught.message : "선택을 저장하지 못했습니다.");
    } finally { setPending(false); }
  }

  return <section className="dadam-feature-page choice-page">
    <FeatureHero icon={Vote} eyebrow="TODAY'S PICK" title="오늘의 선택" description="둘 중 지금 마음이 가는 쪽을 골라보세요."/>
    {loading ? <div className="feature-loading">오늘의 질문을 준비하고 있어요.</div> : !choice ? <div className="feature-empty">오늘의 질문이 아직 등록되지 않았습니다.</div> : <article className="choice-card">
      <time dateTime={choice.activeOn}>{new Date(`${choice.activeOn}T00:00:00+09:00`).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}</time>
      <h2>{choice.question}</h2><p>{choice.description}</p>
      <div className="choice-options">{choice.options.map((option) => {
        const percent = total ? Math.round(option.voteCount / total * 100) : 0;
        const selected = choice.myOptionId === option.id;
        return <button key={option.id} type="button" className={selected ? "selected" : ""} onClick={() => void voteFor(option.id)} disabled={pending}>
          <i style={{ width: choice.myOptionId ? `${percent}%` : 0 }}/><span className="choice-emoji">{option.emoji}</span><strong>{option.label}</strong>
          {choice.myOptionId && <b>{percent}%</b>}
        </button>;
      })}</div>
      <small>{choice.myOptionId ? `${total.toLocaleString()}명이 선택했어요 · 선택을 다시 누르면 변경할 수 있어요.` : "선택하면 전체 결과를 확인할 수 있어요."}</small>
      {error && <p className="feature-error">{error}</p>}
    </article>}
  </section>;
}

type MailboxPost = { id: string; authorAlias: string; title: string; content: string; createdAt: string; commentCount: number };
type MailboxComment = { id: string; authorAlias: string; content: string; replyType: string | null; createdAt: string };
const mailboxReplies = [
  ["cheer", "응원해요", "💪"], ["understand", "이해해요", "🌿"], ["helpful", "도움이 됐어요", "💡"],
  ["empathy", "공감합니다", "💛"], ["thanks", "마음을 나눠줘서 고마워요", "💌"], ["together", "함께할게요", "🤝"],
  ["heavy", "마음이 많이 무거웠겠어요", "🌧️"], ["upset", "많이 속상했겠어요", "🫂"], ["listen", "판단하지 않고 들을게요", "👂"],
  ["respect", "그 선택을 존중해요", "🌱"], ["slowly", "천천히 해도 괜찮아요", "🐢"], ["not_alone", "혼자가 아니에요", "🕯️"],
  ["no_answer", "지금은 답을 찾지 않아도 괜찮아요", "🌙"], ["sorry", "그런 일을 겪었다니 마음이 아파요", "💧"],
  ["courage", "이야기해 준 용기가 대단해요", "🪴"], ["rest", "오늘은 마음부터 쉬어가도 괜찮아요", "🫖"],
] as const;

export function DadamMailbox() {
  const redirectLogin = useLoginRedirect();
  const [posts, setPosts] = useState<MailboxPost[]>([]);
  const [selected, setSelected] = useState<{ post: MailboxPost; comments: MailboxComment[]; myReplyType: string | null } | null>(null);
  const [compose, setCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [replyPending, setReplyPending] = useState(false);
  const [myAnonymousAlias,setMyAnonymousAlias] = useState<string | null>(null);
  const [canPostToday,setCanPostToday] = useState(false);

  const loadPosts = useCallback((targetPage = page) => apiRequest<{ posts: MailboxPost[]; page: number; totalPages: number; myAnonymousAlias:string | null; canPostToday:boolean }>(`/api/features/mailbox?page=${targetPage}`).then((data) => { setPosts(data.posts); setPage(data.page); setTotalPages(data.totalPages); setMyAnonymousAlias(data.myAnonymousAlias); setCanPostToday(data.canPostToday); }).catch((caught) => setError(caught instanceof Error ? caught.message : "우체통을 불러오지 못했습니다.")).finally(() => setLoading(false)), [page]);
  useEffect(() => { void loadPosts(page); }, [loadPosts, page]);

  async function openPost(id: string) {
    try { setSelected(await apiRequest(`/api/features/mailbox/${id}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "사연을 열지 못했습니다."); }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const created = await apiRequest<{ id: string }>("/api/features/mailbox", { method: "POST", body: JSON.stringify({ title: form.get("title"), content: form.get("content") }) });
      setCompose(false); await loadPosts(1); await openPost(created.id);
    } catch (caught) { if (!redirectLogin(caught)) setError(caught instanceof Error ? caught.message : "사연을 등록하지 못했습니다."); }
  }

  async function sendReply(replyType: string) {
    if (!selected || replyPending) return;
    setReplyPending(true);
    try {
      await apiRequest(`/api/features/mailbox/${selected.post.id}`, { method: "POST", body: JSON.stringify({ replyType }) });
      await openPost(selected.post.id); await loadPosts(page);
    } catch (caught) { if (!redirectLogin(caught)) setError(caught instanceof Error ? caught.message : "답장을 등록하지 못했습니다."); }
    finally { setReplyPending(false); }
  }

  return <section className="dadam-feature-page mailbox-page">
    <FeatureHero icon={Mail} eyebrow="ANONYMOUS LETTER" title="다담 우체통" description="이름 대신 고정된 익명 ID로 마음을 나누는 공간이에요."/>
    <div className="mailbox-notice"><strong>{myAnonymousAlias ? `나의 익명 ID · ${myAnonymousAlias}` : "고정 익명 ID로 참여해요."}</strong><span>사연은 하루에 한 번, 답장은 사연마다 한 번만 보낼 수 있어요.</span></div>
    <button className="feature-primary-button" type="button" disabled={!canPostToday && Boolean(myAnonymousAlias)} onClick={() => setCompose((value) => !value)}><Send size={17}/>{compose ? "작성 취소" : !canPostToday && myAnonymousAlias ? "오늘의 사연을 이미 보냈어요" : "익명 사연 보내기"}</button>
    {compose && <form className="feature-form" onSubmit={submitPost}><label>제목<input name="title" required maxLength={80} placeholder="어떤 이야기인지 짧게 적어주세요"/></label><label>사연<textarea name="content" required maxLength={4000} rows={7} placeholder="편하게 이야기해 주세요. 실제 회원 정보는 공개되지 않아요."/></label><button type="submit">익명으로 보내기</button></form>}
    {selected && <article className="mailbox-detail"><button className="feature-text-button" type="button" onClick={() => setSelected(null)}>← 목록으로</button><small>익명 {selected.post.authorAlias}</small><h2>{selected.post.title}</h2><p>{selected.post.content}</p><time>{formatDate(selected.post.createdAt)}</time>
      <div className="mailbox-replies"><h3><MessageCircle size={17}/> 익명 답장 {selected.comments.length}</h3>{selected.comments.map((comment) => <div key={comment.id}><strong>익명 {comment.authorAlias}</strong><p>{comment.content}</p><time>{formatDate(comment.createdAt)}</time></div>)}</div>
      <div className="mailbox-reply-form"><strong>조언보다 지금 전하고 싶은 마음을 골라주세요.</strong><small>한 사연에는 한 번만 답장할 수 있고, 다른 문구를 누르면 답장이 변경돼요.</small><div>{mailboxReplies.map(([value,label,emoji]) => <button className={selected.myReplyType === value ? "selected" : ""} key={value} type="button" disabled={replyPending || selected.myReplyType === value} onClick={() => void sendReply(value)}><span>{emoji}</span>{label}{selected.myReplyType === value && <b>보낸 답장</b>}</button>)}</div></div>
    </article>}
    {!selected && <div className="mailbox-list">{loading ? <div className="feature-loading">우체통을 열고 있어요.</div> : posts.length ? posts.map((post) => <button type="button" key={post.id} onClick={() => void openPost(post.id)}><span className="mail-stamp">익명<br/>{post.authorAlias}</span><span><strong>{post.title}</strong><p>{post.content}</p><small>{formatDate(post.createdAt)} · 답장 {post.commentCount}</small></span><ArrowRight size={17}/></button>) : <div className="feature-empty">첫 번째 익명 사연을 기다리고 있습니다.</div>}</div>}
    {!selected && <nav className="feature-pagination" aria-label="다담 우체통 페이지"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1,value - 1))}><ChevronLeft size={18}/></button>{mailboxPageNumbers(page,totalPages).map((number) => <button type="button" className={number === page ? "active" : ""} key={number} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages,value + 1))}><ChevronRight size={18}/></button></nav>}
    {error && <p className="feature-error">{error}</p>}
  </section>;
}

type TasteDimension = "energy" | "rhythm" | "social" | "expression";
type TasteQuestion = { id: string; dimension: TasteDimension; question: string; options: Array<{ label: string; score: number }> };
const dimensionLabels: Record<TasteDimension,[string,string]> = { energy:["안온한 충전","새로운 자극"], rhythm:["계획적 리듬","유연한 흐름"], social:["독립적 몰입","관계 속 활력"], expression:["차분한 간직","선명한 표현"] };

export function TasteLab() {
  const [questions,setQuestions] = useState<TasteQuestion[]>([]); const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<Array<{ questionId:string; score:number }>>([]); const [finalScores, setFinalScores] = useState<Record<TasteDimension,number> | null>(null); const [notice, setNotice] = useState("");
  const loadQuestions = useCallback(() => { setLoading(true); setError(""); return apiRequest<{ questions:TasteQuestion[] }>("/api/features/taste").then((data) => setQuestions(data.questions)).catch((caught) => setError(caught instanceof Error ? caught.message : "취향 문항을 불러오지 못했습니다.")).finally(() => setLoading(false)); },[]);
  useEffect(() => { let active = true; void apiRequest<{ questions:TasteQuestion[] }>("/api/features/taste").then((data) => { if (active) setQuestions(data.questions); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "취향 문항을 불러오지 못했습니다."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; },[]);
  async function answer(score: number) {
    const next = [...answers, { questionId:questions[step].id,score }]; setAnswers(next);
    if (step < questions.length - 1) { setStep(step + 1); return; }
    try { const data = await apiRequest<{ scores:Record<TasteDimension,number>; saved:boolean }>("/api/features/taste", { method: "POST", body: JSON.stringify({ answers: next }) }); setFinalScores(data.scores); setNotice(data.saved ? "상세 결과를 계정에 저장했어요." : "로그인하면 다음에도 이 결과를 확인할 수 있어요."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "결과를 분석하지 못했습니다."); }
  }
  function reset() { setStep(0); setAnswers([]); setFinalScores(null); setNotice(""); void loadQuestions(); }
  const profile = finalScores ? buildTasteProfile(finalScores) : null;
  const current = questions[step];
  return <section className="dadam-feature-page taste-page"><FeatureHero icon={Sparkles} eyebrow="TASTE LAB" title="취향 발견실" description="일상 속 선택을 따라가며 나에게 잘 맞는 생활 취향을 발견해 보세요."/>
    {loading ? <div className="feature-loading">취향 문항을 준비하고 있어요.</div> : error ? <div className="feature-empty">{error}<button type="button" onClick={() => void loadQuestions()}>다시 불러오기</button></div> : !profile || !finalScores ? current && <article className="taste-card"><div className="taste-progress"><i style={{ width: `${(step + 1) / questions.length * 100}%` }}/></div><small>{step + 1} / {questions.length}</small><h2>{current.question}</h2><div>{current.options.map((option) => <button type="button" key={option.label} onClick={() => void answer(option.score)}><span>{option.label}</span><ArrowRight size={19}/></button>)}</div></article> : <article className="taste-result"><span>{profile.emoji}</span><small>나의 생활 취향</small><h2>{profile.name}</h2><p>{profile.summary}</p><div className="taste-analysis">{(Object.keys(finalScores) as TasteDimension[]).map((dimension) => { const max = dimension === "social" || dimension === "expression" ? 4 : 6; const percent = Math.round((finalScores[dimension] + max) / (max * 2) * 100); return <div key={dimension}><span>{dimensionLabels[dimension][0]}</span><i><b style={{ width: `${percent}%` }}/></i><span>{dimensionLabels[dimension][1]}</span></div>; })}</div><div className="taste-detail"><section><strong>잘 맞는 일상</strong><p>{profile.fit}</p></section><section><strong>나만의 강점</strong><p>{profile.strength}</p></section><section><strong>균형을 위한 제안</strong><p>{profile.tip}</p></section></div><button type="button" onClick={reset}><RefreshCw size={18}/> 다시 해보기</button>{notice && <em>{notice}</em>}</article>}
  </section>;
}

function buildTasteProfile(scores: Record<TasteDimension,number>) {
  const energy = Math.sign(scores.energy); const rhythm = Math.sign(scores.rhythm); const social = Math.sign(scores.social); const expression = Math.sign(scores.expression);
  const names = [energy > 0 ? "호기심 탐험가" : energy < 0 ? "포근한 충전가" : "균형 잡힌 전환가", rhythm > 0 ? "유연한 발견자" : rhythm < 0 ? "단단한 설계자" : "균형 잡힌 조율가", social > 0 ? "다정한 연결자" : social < 0 ? "깊이 있는 몰입가" : "관계 균형가", expression > 0 ? "선명한 표현가" : expression < 0 ? "고요한 수집가" : "담백한 표현가"];
  const dominant = (Object.keys(scores) as TasteDimension[]).sort((a,b) => Math.abs(scores[b]) - Math.abs(scores[a]))[0];
  const dominantTitles: Record<TasteDimension,string> = { energy:"에너지 중심형",rhythm:"생활 리듬 중심형",social:"관계 감각 중심형",expression:"표현 취향 중심형" };
  return {
    emoji: dominant === "energy" ? (energy > 0 ? "🧭" : energy < 0 ? "🫖" : "🌤️") : dominant === "rhythm" ? (rhythm > 0 ? "🌊" : rhythm < 0 ? "🗓️" : "⚖️") : dominant === "social" ? (social > 0 ? "🤝" : social < 0 ? "🌙" : "🌿") : (expression > 0 ? "✨" : expression < 0 ? "📚" : "🪞"),
    name: `${dominantTitles[dominant]} · ${names[0]} ${names[2]}`,
    summary: `${energy > 0 ? "새로운 자극에서 에너지를 얻는 편" : energy < 0 ? "익숙하고 편안한 환경에서 에너지를 회복하는 편" : "휴식과 새로움을 상황에 맞게 오가는 편"}이며, ${rhythm > 0 ? "상황의 흐름을 유연하게 활용합니다" : rhythm < 0 ? "미리 구조를 세울 때 마음이 안정됩니다" : "계획과 즉흥성을 균형 있게 사용합니다"}. ${social > 0 ? "사람과 경험을 나눌 때 만족이 커지고" : social < 0 ? "혼자 충분히 생각할 때 내 취향이 또렷해지며" : "혼자 있는 시간과 관계 속 시간을 고르게 필요로 하며"}, ${expression > 0 ? "좋아하는 것을 분명히 드러냅니다" : expression < 0 ? "좋아하는 것을 조용히 오래 간직합니다" : "필요한 순간에만 담백하게 표현합니다"}.`,
    fit: `${energy > 0 ? "새로운 장소나 짧은 체험" : energy < 0 ? "편안한 공간과 충분한 휴식" : "익숙함 속 작은 변화"}에 ${rhythm > 0 ? "선택할 여백이 있는 일정" : rhythm < 0 ? "예측 가능한 일정" : "핵심만 정한 가벼운 계획"}을 더하면 만족도가 높아요.`,
    strength: `${social > 0 ? "분위기와 감정을 읽고 관계를 따뜻하게 만드는 힘" : social < 0 ? "깊이 관찰하고 생각을 자기 방식으로 완성하는 힘" : "혼자와 함께의 경계를 자연스럽게 조절하는 힘"}이 있습니다. ${expression > 0 ? "취향을 분명하게 전달하는 감각" : expression < 0 ? "쉽게 휩쓸리지 않고 오래 좋아하는 집중력" : "상황에 맞는 표현의 강도를 고르는 감각"}도 강점이에요.`,
    tip: `${energy > 0 ? "자극이 이어질 때는 아무 일정 없는 회복 시간을" : energy < 0 ? "안전한 일상 속에 아주 작은 새로움을" : "그날의 에너지 상태를 먼저 확인하는 습관을"} 의도적으로 넣어보세요. ${rhythm > 0 ? "중요한 약속만큼은 미리 기준을 정하면" : rhythm < 0 ? "계획 사이에 빈칸을 남겨두면" : "중요한 일과 자유로운 일을 구분하면"} 지금의 장점이 더 편안하게 살아납니다.`,
  };
}

type Treasure = { id: string; title: string; treasureType: string; description: string; address: string; latitude: number | null; longitude: number | null; authorName: string; createdAt: string };
const treasureTypes = { walk: "산책", food: "먹거리", pet: "반려동물", rest: "쉼터", photo: "사진 명소", helpful: "생활 정보" } as const;

export function TreasureMap() {
  const redirectLogin = useLoginRedirect(); const [items, setItems] = useState<Treasure[]>([]); const [selected, setSelected] = useState<Treasure | null>(null); const [compose, setCompose] = useState(false); const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null); const [error, setError] = useState("");
  const load = () => apiRequest<{ treasures: Treasure[] }>("/api/features/treasures").then((data) => { setItems(data.treasures); setSelected((current) => current || data.treasures.find((item) => item.latitude !== null) || data.treasures[0] || null); }).catch((caught) => setError(caught instanceof Error ? caught.message : "동네 보물을 불러오지 못했습니다."));
  useEffect(() => { void load(); }, []);
  function locate() { navigator.geolocation?.getCurrentPosition((position) => setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude }), () => setError("현재 위치를 확인하지 못했습니다."), { enableHighAccuracy: true, timeout: 8000 }); }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); try { await apiRequest("/api/features/treasures", { method: "POST", body: JSON.stringify({ title: form.get("title"), treasureType: form.get("treasureType"), description: form.get("description"), address: form.get("address"), latitude: coords?.latitude, longitude: coords?.longitude }) }); setCompose(false); setCoords(null); await load(); } catch (caught) { if (!redirectLogin(caught)) setError(caught instanceof Error ? caught.message : "장소를 등록하지 못했습니다."); } }
  const mapUrl = selected?.latitude != null && selected.longitude != null ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.longitude - .006}%2C${selected.latitude - .004}%2C${selected.longitude + .006}%2C${selected.latitude + .004}&layer=mapnik&marker=${selected.latitude}%2C${selected.longitude}` : null;
  return <section className="dadam-feature-page treasure-page"><FeatureHero icon={MapPin} eyebrow="LOCAL TREASURE" title="동네 보물지도" description="광고가 아닌, 이웃이 직접 발견한 생활 속 좋은 장소를 모아요."/>
    <button className="feature-primary-button" type="button" onClick={() => setCompose((value) => !value)}><MapPin size={17}/>{compose ? "등록 취소" : "동네 보물 등록"}</button>
    {compose && <form className="feature-form" onSubmit={submit}><label>장소 이름<input name="title" required maxLength={100}/></label><label>유형<select name="treasureType" required>{Object.entries(treasureTypes).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>주소<input name="address" required maxLength={300} placeholder="도로명이나 찾기 쉬운 위치를 적어주세요"/></label><label>소개<textarea name="description" required maxLength={1000} rows={4}/></label><p className="location-privacy">집 주소처럼 개인을 특정할 수 있는 위치는 등록하지 마세요.</p><button className="location-button" type="button" onClick={locate}><LocateFixed size={16}/>{coords ? "현재 위치를 확인했어요" : "현재 위치 함께 등록"}</button><button type="submit">지도에 등록하기</button></form>}
    <div className="treasure-map-frame">{mapUrl ? <iframe title={`${selected?.title} 지도`} src={mapUrl} loading="lazy"/> : <div><MapPin size={28}/><strong>위치가 등록된 장소를 선택해 주세요.</strong></div>}</div>
    <div className="treasure-list">{items.map((item) => <button key={item.id} type="button" className={selected?.id === item.id ? "selected" : ""} onClick={() => setSelected(item)}><b>{treasureTypes[item.treasureType as keyof typeof treasureTypes] || "장소"}</b><strong>{item.title}</strong><p>{item.description}</p><span><MapPin size={13}/>{item.address}</span><small>{item.authorName} · {formatDate(item.createdAt)}</small></button>)}</div>
    {!items.length && <div className="feature-empty">아직 등록된 동네 보물이 없습니다.</div>}{error && <p className="feature-error">{error}</p>}
  </section>;
}

type RandomPost = { id: string; title: string; excerpt: string; authorName: string; categoryName: string; viewCount: number; commentCount: number; createdAt: string };
export function RandomJourney() {
  const [post, setPost] = useState<RandomPost | null>(null); const [category, setCategory] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function travel() { setLoading(true); setError(""); try { const data = await apiRequest<{ post: RandomPost | null }>(`/api/features/random-story${category ? `?category=${encodeURIComponent(category)}` : ""}`); setPost(data.post); } catch (caught) { setError(caught instanceof Error ? caught.message : "이야기를 찾지 못했습니다."); } finally { setLoading(false); } }
  return <section className="dadam-feature-page random-page"><FeatureHero icon={Compass} eyebrow="STORY JOURNEY" title="랜덤 이야기 여행" description="최신 글 아래에 잠들어 있던 모두다담의 이야기를 우연히 만나보세요."/>
    <article className="random-machine"><label>여행할 게시판<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">모든 게시판</option>{categories.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><button type="button" onClick={() => void travel()} disabled={loading}><Compass size={20}/>{loading ? "이야기를 찾는 중..." : post ? "다른 이야기 만나기" : "랜덤 여행 시작"}</button></article>
    {post && <Link className="random-story-card" href={`/posts/${post.id}`}><small>{post.categoryName}</small><h2>{post.title}</h2><p>{post.excerpt || "본문을 열어 이야기를 확인해 보세요."}</p><span>{post.authorName} · 조회 {post.viewCount} · 댓글 {post.commentCount}</span><b>이야기 읽기 <ArrowRight size={16}/></b></Link>}
    {!post && !loading && <div className="random-orbit"><i/><span>?</span><p>어떤 이야기를 만나게 될까요?</p></div>}{error && <p className="feature-error">{error}</p>}
  </section>;
}

function formatDate(value: string) { return new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function mailboxPageNumbers(page: number,totalPages: number) { const start = Math.max(1,Math.min(page - 1,totalPages - 2)); const end = Math.min(totalPages,start + 2); return Array.from({ length: end - start + 1 },(_,index) => start + index); }
