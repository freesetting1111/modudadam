"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Compass, LocateFixed, Mail, MapPin, MessageCircle, RefreshCw, Send, Sparkles, Vote } from "lucide-react";
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
type MailboxComment = { id: string; authorAlias: string; content: string; createdAt: string };

export function DadamMailbox() {
  const redirectLogin = useLoginRedirect();
  const [posts, setPosts] = useState<MailboxPost[]>([]);
  const [selected, setSelected] = useState<{ post: MailboxPost; comments: MailboxComment[] } | null>(null);
  const [compose, setCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPosts = () => apiRequest<{ posts: MailboxPost[] }>("/api/features/mailbox").then((data) => setPosts(data.posts)).catch((caught) => setError(caught instanceof Error ? caught.message : "우체통을 불러오지 못했습니다.")).finally(() => setLoading(false));
  useEffect(() => { void loadPosts(); }, []);

  async function openPost(id: string) {
    try { setSelected(await apiRequest(`/api/features/mailbox/${id}`)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "사연을 열지 못했습니다."); }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const created = await apiRequest<{ id: string }>("/api/features/mailbox", { method: "POST", body: JSON.stringify({ title: form.get("title"), content: form.get("content") }) });
      setCompose(false); await loadPosts(); await openPost(created.id);
    } catch (caught) { if (!redirectLogin(caught)) setError(caught instanceof Error ? caught.message : "사연을 등록하지 못했습니다."); }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; const form = new FormData(event.currentTarget);
    try {
      await apiRequest(`/api/features/mailbox/${selected.post.id}`, { method: "POST", body: JSON.stringify({ content: form.get("content") }) });
      event.currentTarget.reset(); await openPost(selected.post.id); await loadPosts();
    } catch (caught) { if (!redirectLogin(caught)) setError(caught instanceof Error ? caught.message : "답장을 등록하지 못했습니다."); }
  }

  return <section className="dadam-feature-page mailbox-page">
    <FeatureHero icon={Mail} eyebrow="ANONYMOUS LETTER" title="다담 우체통" description="이름 대신 고정된 익명 ID로 마음을 나누는 공간이에요."/>
    <div className="mailbox-notice"><strong>익명 ID는 사연마다 고정됩니다.</strong><span>같은 사연에서는 작성자와 답장 참여자의 ID가 바뀌지 않아요.</span></div>
    <button className="feature-primary-button" type="button" onClick={() => setCompose((value) => !value)}><Send size={17}/>{compose ? "작성 취소" : "익명 사연 보내기"}</button>
    {compose && <form className="feature-form" onSubmit={submitPost}><label>제목<input name="title" required maxLength={80} placeholder="어떤 이야기인지 짧게 적어주세요"/></label><label>사연<textarea name="content" required maxLength={4000} rows={7} placeholder="편하게 이야기해 주세요. 실제 회원 정보는 공개되지 않아요."/></label><button type="submit">익명으로 보내기</button></form>}
    {selected && <article className="mailbox-detail"><button className="feature-text-button" type="button" onClick={() => setSelected(null)}>← 목록으로</button><small>익명 {selected.post.authorAlias}</small><h2>{selected.post.title}</h2><p>{selected.post.content}</p><time>{formatDate(selected.post.createdAt)}</time>
      <div className="mailbox-replies"><h3><MessageCircle size={17}/> 익명 답장 {selected.comments.length}</h3>{selected.comments.map((comment) => <div key={comment.id}><strong>익명 {comment.authorAlias}</strong><p>{comment.content}</p><time>{formatDate(comment.createdAt)}</time></div>)}</div>
      <form className="mailbox-reply-form" onSubmit={submitComment}><textarea name="content" required maxLength={2000} rows={3} placeholder="따뜻한 답장을 남겨주세요."/><button type="submit">답장 보내기</button></form>
    </article>}
    {!selected && <div className="mailbox-list">{loading ? <div className="feature-loading">우체통을 열고 있어요.</div> : posts.length ? posts.map((post) => <button type="button" key={post.id} onClick={() => void openPost(post.id)}><span className="mail-stamp">익명<br/>{post.authorAlias}</span><span><strong>{post.title}</strong><p>{post.content}</p><small>{formatDate(post.createdAt)} · 답장 {post.commentCount}</small></span><ArrowRight size={17}/></button>) : <div className="feature-empty">첫 번째 익명 사연을 기다리고 있습니다.</div>}</div>}
    {error && <p className="feature-error">{error}</p>}
  </section>;
}

const tasteQuestions = [
  { question: "갑자기 하루가 비었다면?", options: [["집에서 좋아하는 것을 하며 쉰다", "cozy"], ["처음 가보는 곳으로 나간다", "curious"]] },
  { question: "새 물건을 고를 때 더 중요한 것은?", options: [["오래 써도 편안한 실용성", "balanced"], ["볼 때마다 기분 좋아지는 개성", "spark"]] },
  { question: "친구와 시간을 보낸다면?", options: [["조용한 공간에서 깊게 이야기한다", "cozy"], ["새로운 체험을 함께 해본다", "curious"]] },
  { question: "나를 표현하는 방식은?", options: [["차분하게 꾸준히 보여준다", "balanced"], ["좋아하는 것을 확실하게 드러낸다", "spark"]] },
  { question: "여행 전날의 나는?", options: [["필요한 것을 꼼꼼히 준비한다", "balanced"], ["설렘을 따라 유연하게 움직인다", "curious"]] },
] as const;
const tasteResults = {
  cozy: { emoji: "🫖", name: "포근한 기록가", text: "익숙한 것에서 깊은 행복을 발견하고, 다정한 순간을 오래 간직하는 취향이에요." },
  curious: { emoji: "🧭", name: "호기심 많은 탐험가", text: "새로운 장소와 경험에서 에너지를 얻고, 발견한 즐거움을 나누는 취향이에요." },
  balanced: { emoji: "🌿", name: "단단한 생활가", text: "편안함과 실용성의 균형을 잘 찾고, 일상을 안정적으로 가꾸는 취향이에요." },
  spark: { emoji: "✨", name: "반짝이는 표현가", text: "좋아하는 것이 분명하고, 자신만의 감각으로 일상을 즐겁게 만드는 취향이에요." },
} as const;

export function TasteLab() {
  const redirectLogin = useLoginRedirect();
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<string[]>([]); const [resultCode, setResultCode] = useState<keyof typeof tasteResults | null>(null); const [notice, setNotice] = useState(""); const [saved, setSaved] = useState(false);
  async function answer(code: string) {
    const next = [...answers, code]; setAnswers(next);
    if (step < tasteQuestions.length - 1) { setStep(step + 1); return; }
    const counts = next.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item]: (acc[item] || 0) + 1 }), {});
    const result = (Object.keys(tasteResults) as Array<keyof typeof tasteResults>).sort((a, b) => (counts[b] || 0) - (counts[a] || 0))[0];
    setResultCode(result);
    try { await apiRequest("/api/features/taste", { method: "POST", body: JSON.stringify({ quizCode: "daily-style-v1", resultCode: result, answers: next }) }); setSaved(true); setNotice("결과를 계정에 저장했어요."); }
    catch (caught) { if (!(caught instanceof ApiError && caught.status === 401)) setNotice(caught instanceof Error ? caught.message : "결과를 저장하지 못했습니다."); }
  }
  function reset() { setStep(0); setAnswers([]); setResultCode(null); setNotice(""); setSaved(false); }
  const result = resultCode ? tasteResults[resultCode] : null;
  return <section className="dadam-feature-page taste-page"><FeatureHero icon={Sparkles} eyebrow="TASTE LAB" title="취향 발견실" description="다섯 가지 선택으로 오늘의 생활 취향을 발견해 보세요."/>
    {!result ? <article className="taste-card"><div className="taste-progress"><i style={{ width: `${(step + 1) / tasteQuestions.length * 100}%` }}/></div><small>{step + 1} / {tasteQuestions.length}</small><h2>{tasteQuestions[step].question}</h2><div>{tasteQuestions[step].options.map(([label, code]) => <button type="button" key={label} onClick={() => void answer(code)}>{label}<ArrowRight size={17}/></button>)}</div></article> : <article className="taste-result"><span>{result.emoji}</span><small>나의 생활 취향</small><h2>{result.name}</h2><p>{result.text}</p><button type="button" onClick={reset}><RefreshCw size={16}/> 다시 해보기</button>{notice && <em>{notice}</em>}{!saved && <button className="taste-save-login" type="button" onClick={() => redirectLogin(new ApiError("", 401))}>로그인하고 결과 저장하기</button>}</article>}
  </section>;
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
