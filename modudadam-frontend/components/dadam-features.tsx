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
] as const;

export function DadamMailbox() {
  const redirectLogin = useLoginRedirect();
  const [posts, setPosts] = useState<MailboxPost[]>([]);
  const [selected, setSelected] = useState<{ post: MailboxPost; comments: MailboxComment[] } | null>(null);
  const [compose, setCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [replyPending, setReplyPending] = useState(false);

  const loadPosts = useCallback((targetPage = page) => apiRequest<{ posts: MailboxPost[]; page: number; totalPages: number }>(`/api/features/mailbox?page=${targetPage}`).then((data) => { setPosts(data.posts); setPage(data.page); setTotalPages(data.totalPages); }).catch((caught) => setError(caught instanceof Error ? caught.message : "우체통을 불러오지 못했습니다.")).finally(() => setLoading(false)), [page]);
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
    <div className="mailbox-notice"><strong>익명 ID는 사연마다 고정됩니다.</strong><span>같은 사연에서는 작성자와 답장 참여자의 ID가 바뀌지 않아요.</span></div>
    <button className="feature-primary-button" type="button" onClick={() => setCompose((value) => !value)}><Send size={17}/>{compose ? "작성 취소" : "익명 사연 보내기"}</button>
    {compose && <form className="feature-form" onSubmit={submitPost}><label>제목<input name="title" required maxLength={80} placeholder="어떤 이야기인지 짧게 적어주세요"/></label><label>사연<textarea name="content" required maxLength={4000} rows={7} placeholder="편하게 이야기해 주세요. 실제 회원 정보는 공개되지 않아요."/></label><button type="submit">익명으로 보내기</button></form>}
    {selected && <article className="mailbox-detail"><button className="feature-text-button" type="button" onClick={() => setSelected(null)}>← 목록으로</button><small>익명 {selected.post.authorAlias}</small><h2>{selected.post.title}</h2><p>{selected.post.content}</p><time>{formatDate(selected.post.createdAt)}</time>
      <div className="mailbox-replies"><h3><MessageCircle size={17}/> 익명 답장 {selected.comments.length}</h3>{selected.comments.map((comment) => <div key={comment.id}><strong>익명 {comment.authorAlias}</strong><p>{comment.content}</p><time>{formatDate(comment.createdAt)}</time></div>)}</div>
      <div className="mailbox-reply-form"><strong>마음에 가까운 답장을 골라 보내주세요.</strong><div>{mailboxReplies.map(([value,label,emoji]) => <button key={value} type="button" disabled={replyPending} onClick={() => void sendReply(value)}><span>{emoji}</span>{label}</button>)}</div></div>
    </article>}
    {!selected && <div className="mailbox-list">{loading ? <div className="feature-loading">우체통을 열고 있어요.</div> : posts.length ? posts.map((post) => <button type="button" key={post.id} onClick={() => void openPost(post.id)}><span className="mail-stamp">익명<br/>{post.authorAlias}</span><span><strong>{post.title}</strong><p>{post.content}</p><small>{formatDate(post.createdAt)} · 답장 {post.commentCount}</small></span><ArrowRight size={17}/></button>) : <div className="feature-empty">첫 번째 익명 사연을 기다리고 있습니다.</div>}</div>}
    {!selected && <nav className="feature-pagination" aria-label="다담 우체통 페이지"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1,value - 1))}><ChevronLeft size={18}/></button>{mailboxPageNumbers(page,totalPages).map((number) => <button type="button" className={number === page ? "active" : ""} key={number} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages,value + 1))}><ChevronRight size={18}/></button></nav>}
    {error && <p className="feature-error">{error}</p>}
  </section>;
}

type TasteDimension = "energy" | "rhythm" | "social" | "expression";
const fiveOptions = (labels: [string,string,string,string,string]) => labels.map((label,index) => ({ label, score: index - 2 }));
const tasteQuestions: Array<{ question: string; dimension: TasteDimension; options: Array<{ label: string; score: number }> }> = [
  { question: "예상에 없던 하루의 여유가 생겼어요. 가장 끌리는 방식은?", dimension: "energy", options: fiveOptions(["약속을 미루고 온전히 쉰다","집 근처에서 조용히 시간을 보낸다","그날 컨디션을 보고 정한다","궁금했던 장소 한 곳을 찾아간다","처음 보는 경험으로 하루를 채운다"]) },
  { question: "여행을 준비할 때 내 모습과 가장 가까운 것은?", dimension: "rhythm", options: fiveOptions(["시간대별 계획과 후보지를 모두 정한다","꼭 갈 곳과 이동만 미리 정한다","핵심 일정만 잡고 여백을 둔다","숙소만 정하고 현지에서 결정한다","목적지만 정하고 즉흥적으로 움직인다"]) },
  { question: "마음이 복잡할 때 가장 회복되는 순간은?", dimension: "social", options: fiveOptions(["혼자 생각을 정리할 충분한 시간","말없이 나만의 취미에 집중하는 시간","상황에 따라 혼자 또는 함께","가까운 한 사람과 깊게 나누는 대화","여럿과 웃고 이야기하며 보내는 시간"]) },
  { question: "좋아하는 것을 발견했을 때 보통 어떻게 하나요?", dimension: "expression", options: fiveOptions(["혼자 오래 간직하며 즐긴다","필요한 사람에게만 조용히 알려준다","상황에 따라 공유한다","사진이나 글로 주변에 소개한다","누구나 알 수 있게 적극적으로 표현한다"]) },
  { question: "새로운 취미를 시작한다면 어떤 방식이 편한가요?", dimension: "energy", options: fiveOptions(["익숙한 취미를 더 깊게 해본다","집에서 천천히 배울 수 있는 것을 고른다","부담 없는 체험부터 해본다","수업이나 모임에 참여해 본다","완전히 낯선 분야에 바로 도전한다"]) },
  { question: "해야 할 일이 많아졌을 때 나는?", dimension: "rhythm", options: fiveOptions(["우선순위와 시간을 세세하게 나눈다","목록을 만들고 차례대로 처리한다","중요한 것부터 유연하게 처리한다","마음이 가는 일부터 시작한다","순간의 집중력과 흐름에 맡긴다"]) },
  { question: "주말 약속을 잡을 때 가장 편한 형태는?", dimension: "social", options: fiveOptions(["혼자 보내는 시간이 가장 좋다","한두 명과 조용히 만난다","혼자와 만남을 적당히 섞는다","여러 친구와 활동적인 약속을 잡는다","새로운 사람도 있는 큰 모임이 즐겁다"]) },
  { question: "나만의 공간을 꾸민다면 어디에 더 가까운가요?", dimension: "expression", options: fiveOptions(["색을 줄이고 편안하게 정돈한다","오래 써도 질리지 않는 물건을 둔다","실용성과 개성을 반반 섞는다","좋아하는 색과 소품을 분명히 드러낸다","한눈에 내 취향이 보이도록 과감하게 꾸민다"]) },
  { question: "새로운 동네에 도착했을 때 먼저 하는 행동은?", dimension: "energy", options: fiveOptions(["숙소나 조용한 공간에서 적응한다","가까운 곳부터 천천히 둘러본다","지도와 분위기를 보고 정한다","인기 장소를 찾아 바로 움직인다","계획 없이 골목과 사람들 속으로 들어간다"]) },
  { question: "중요한 선택을 앞두었을 때 결정 방식은?", dimension: "rhythm", options: fiveOptions(["정보와 장단점을 충분히 정리한다","기준을 세우고 비교한 뒤 고른다","이성과 직감을 함께 본다","마음이 더 가는 쪽을 선택한다","첫 느낌을 믿고 빠르게 결정한다"]) },
];
const dimensionLabels: Record<TasteDimension,[string,string]> = { energy:["안온한 충전","새로운 자극"], rhythm:["계획적 리듬","유연한 흐름"], social:["독립적 몰입","관계 속 활력"], expression:["차분한 간직","선명한 표현"] };

export function TasteLab() {
  const redirectLogin = useLoginRedirect();
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<string[]>([]); const [finalScores, setFinalScores] = useState<Record<TasteDimension,number> | null>(null); const [notice, setNotice] = useState(""); const [saved, setSaved] = useState(false);
  async function answer(score: number) {
    const answerCode = `${tasteQuestions[step].dimension}:${score}`;
    const next = [...answers, answerCode]; setAnswers(next);
    if (step < tasteQuestions.length - 1) { setStep(step + 1); return; }
    const scores = next.reduce<Record<TasteDimension,number>>((acc,item) => { const [dimension,value] = item.split(":") as [TasteDimension,string]; acc[dimension] += Number(value); return acc; }, { energy:0,rhythm:0,social:0,expression:0 });
    const resultCode = `${scores.energy >= 0 ? "E" : "R"}${scores.rhythm >= 0 ? "F" : "P"}${scores.social >= 0 ? "C" : "I"}${scores.expression >= 0 ? "X" : "Q"}`;
    setFinalScores(scores);
    try { await apiRequest("/api/features/taste", { method: "POST", body: JSON.stringify({ quizCode: "lifestyle-depth-v2", resultCode, answers: next }) }); setSaved(true); setNotice("상세 결과를 계정에 저장했어요."); }
    catch (caught) { if (!(caught instanceof ApiError && caught.status === 401)) setNotice(caught instanceof Error ? caught.message : "결과를 저장하지 못했습니다."); }
  }
  function reset() { setStep(0); setAnswers([]); setFinalScores(null); setNotice(""); setSaved(false); }
  const profile = finalScores ? buildTasteProfile(finalScores) : null;
  return <section className="dadam-feature-page taste-page"><FeatureHero icon={Sparkles} eyebrow="TASTE LAB" title="취향 발견실" description="10개의 상황과 5단계 선택으로 생활 취향을 입체적으로 살펴보세요."/>
    {!profile || !finalScores ? <article className="taste-card"><div className="taste-progress"><i style={{ width: `${(step + 1) / tasteQuestions.length * 100}%` }}/></div><small>{step + 1} / {tasteQuestions.length}</small><h2>{tasteQuestions[step].question}</h2><div>{tasteQuestions[step].options.map((option) => <button type="button" key={option.label} onClick={() => void answer(option.score)}><span>{option.label}</span><ArrowRight size={17}/></button>)}</div></article> : <article className="taste-result"><span>{profile.emoji}</span><small>나의 생활 취향 분석</small><h2>{profile.name}</h2><p>{profile.summary}</p><div className="taste-analysis">{(Object.keys(finalScores) as TasteDimension[]).map((dimension) => { const max = dimension === "social" || dimension === "expression" ? 4 : 6; const percent = Math.round((finalScores[dimension] + max) / (max * 2) * 100); return <div key={dimension}><span>{dimensionLabels[dimension][0]}</span><i><b style={{ width: `${percent}%` }}/></i><span>{dimensionLabels[dimension][1]}</span></div>; })}</div><div className="taste-detail"><section><strong>잘 맞는 일상</strong><p>{profile.fit}</p></section><section><strong>나만의 강점</strong><p>{profile.strength}</p></section><section><strong>균형을 위한 제안</strong><p>{profile.tip}</p></section></div><button type="button" onClick={reset}><RefreshCw size={16}/> 다시 해보기</button>{notice && <em>{notice}</em>}{!saved && <button className="taste-save-login" type="button" onClick={() => redirectLogin(new ApiError("", 401))}>로그인하고 결과 저장하기</button>}</article>}
  </section>;
}

function buildTasteProfile(scores: Record<TasteDimension,number>) {
  const active = scores.energy >= 0; const flexible = scores.rhythm >= 0; const connected = scores.social >= 0; const expressive = scores.expression >= 0;
  const names = [active ? "호기심 탐험가" : "포근한 충전가", flexible ? "유연한 발견자" : "단단한 설계자", connected ? "다정한 연결자" : "깊이 있는 몰입가", expressive ? "선명한 표현가" : "고요한 수집가"];
  const dominant = (Object.keys(scores) as TasteDimension[]).sort((a,b) => Math.abs(scores[b]) - Math.abs(scores[a]))[0];
  return {
    emoji: dominant === "energy" ? (active ? "🧭" : "🫖") : dominant === "rhythm" ? (flexible ? "🌊" : "🗓️") : dominant === "social" ? (connected ? "🤝" : "🌙") : (expressive ? "✨" : "📚"),
    name: `${names[0]} · ${names[2]}`,
    summary: `${active ? "새로운 자극에서 에너지를 얻는 편" : "익숙하고 편안한 환경에서 에너지를 회복하는 편"}이며, ${flexible ? "계획보다 상황의 흐름을 잘 활용합니다" : "미리 구조를 세울 때 마음이 안정됩니다"}. ${connected ? "사람과 경험을 나눌 때 만족이 커지고" : "혼자 충분히 생각할 때 내 취향이 또렷해지며"}, ${expressive ? "좋아하는 것을 적극적으로 드러내는 성향" : "좋아하는 것을 조용히 오래 간직하는 성향"}이 함께 보여요.`,
    fit: `${active ? "새로운 장소나 짧은 체험" : "편안한 공간과 충분한 휴식"}에 ${flexible ? "선택할 여백이 있는 일정" : "예측 가능한 일정"}을 더하면 만족도가 높아요.`,
    strength: `${connected ? "사람의 분위기와 감정을 빠르게 읽고 관계를 따뜻하게 만드는 힘" : "혼자서도 깊이 관찰하고 생각을 자기 방식으로 완성하는 힘"}이 있습니다. ${expressive ? "취향을 분명하게 전달하는 감각" : "쉽게 휩쓸리지 않고 오래 좋아하는 집중력"}도 강점이에요.`,
    tip: `${active ? "자극이 이어질 때는 아무 일정 없는 회복 시간을" : "안전한 일상 속에 아주 작은 새로움을"} 의도적으로 넣어보세요. ${flexible ? "중요한 약속만큼은 미리 기준을 정하면" : "계획 사이에 빈칸을 남겨두면"} 지금의 장점이 더 편안하게 살아납니다.`,
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
