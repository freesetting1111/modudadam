"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowRight, Camera, Check, ChevronLeft, ChevronRight, Compass, Footprints, Heart, Lightbulb, Mail, MapPin, MessageCircle, PawPrint, Pencil, RefreshCw, Save, Send, Share2, Sparkles, Trees, Utensils, Vote } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { categories } from "@/lib/categories";
import { StampedName } from "@/components/stamped-name";
import { KakaoPlace, KakaoPlacePicker, KakaoPlaceViewer } from "@/components/kakao-place-map";
import { PostListMeta } from "@/components/post-list-meta";
import { displayPostTitle } from "@/lib/post-display";

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
  const [previousChoice, setPreviousChoice] = useState<Choice | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const load = () => apiRequest<{ choice: Choice | null; previousChoice: Choice | null }>("/api/features/choices").then((data) => { setChoice(data.choice); setPreviousChoice(data.previousChoice); }).catch((caught) => setError(caught instanceof Error ? caught.message : "오늘의 극한 밸런스를 불러오지 못했습니다.")).finally(() => setLoading(false));
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
    <FeatureHero icon={Vote} eyebrow="오늘의 선택" title="극한 밸런스" description="두 선택 중 하나를 고르세요."/>
    {loading ? <div className="feature-loading">오늘의 질문을 준비하고 있어요.</div> : !choice ? <div className="feature-empty">오늘의 질문이 아직 등록되지 않았습니다.</div> : <article className="choice-card">
      <time dateTime={choice.activeOn}>{new Date(`${choice.activeOn}T00:00:00+09:00`).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}</time>
      <h2>{choice.question}</h2><p>{choice.description}</p>
      <div className="choice-options">{choice.options.map((option) => {
        const percent = total ? Math.round(option.voteCount / total * 100) : 0;
        const selected = choice.myOptionId === option.id;
        return <button key={option.id} type="button" className={selected ? "selected" : ""} onClick={() => void voteFor(option.id)} disabled={pending}>
          <i style={{ width: choice.myOptionId ? `${percent}%` : 0 }}/><span className="choice-emoji">{option.emoji}</span><strong>{option.label}</strong>
          {choice.myOptionId && <b><span>{option.voteCount.toLocaleString()}명</span><span>{percent}%</span></b>}
        </button>;
      })}</div>
      <small>{choice.myOptionId ? `참여 ${total.toLocaleString()}명 · 다시 누르면 변경됩니다.` : "선택하면 결과가 표시됩니다."}</small>
      <p className="choice-reward-guide">🌰 자정 기준 다수 선택 3개 · 반대 선택 1개 · 동률 1개</p>
      {error && <p className="feature-error">{error}</p>}
    </article>}
    {previousChoice && <PreviousChoiceResult choice={previousChoice}/>} 
  </section>;
}

function PreviousChoiceResult({ choice }: { choice: Choice }) {
  const total = choice.options.reduce((sum,option) => sum + option.voteCount,0);
  const highest = Math.max(...choice.options.map((option) => option.voteCount));
  const tie=total>0&&choice.options.filter((option)=>option.voteCount===highest).length>1;
  return <article className="previous-choice-card">
    <header><div><small>어제 결과</small><h2>선택 결과</h2></div><time>{new Date(`${choice.activeOn}T00:00:00+09:00`).toLocaleDateString("ko-KR",{ month:"long",day:"numeric",weekday:"short" })}</time></header>
    <h3>{choice.question}</h3>
    <div className="previous-choice-options">{choice.options.map((option) => { const percent = total ? Math.round(option.voteCount / total * 100) : 0; const winner = total > 0 && option.voteCount === highest; const mine = choice.myOptionId === option.id; return <section className={winner ? "winner" : ""} key={option.id}><i style={{ width:`${percent}%` }}/><div><span>{option.emoji}</span><strong>{option.label}</strong>{mine && <em>내 선택</em>}{winner && <b>{tie?"동률":"최다 선택"}</b>}</div><p><strong>{option.voteCount.toLocaleString()}명</strong><span>{percent}%</span></p></section>; })}</div>
    <footer>총 {total.toLocaleString()}명이 참여했어요. {total>0 ? tie ? "동률 참여자는 모두 도토리 1개를 받아요." : "다수 선택은 3개, 반대 선택은 1개를 받아요." : "참여자가 없어 보상이 지급되지 않았어요."}</footer>
  </article>;
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

export function DadamMailbox({ authenticated }:{ authenticated:boolean }) {
  const router=useRouter();
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
    <FeatureHero icon={Mail} eyebrow="익명 우체통" title="다담 우체통" description="고정 익명 ID로 사연을 나눠요."/>
    <div className="mailbox-notice"><strong>{myAnonymousAlias ? `나의 익명 ID · ${myAnonymousAlias}` : authenticated ? "고정 익명 ID로 참여해요." : "사연은 로그인 없이 읽을 수 있어요."}</strong><span>{authenticated ? "사연은 하루에 한 번, 답장은 사연마다 한 번만 보낼 수 있어요." : "사연을 보내거나 답장할 때만 로그인이 필요합니다."}</span></div>
    <button className="feature-primary-button" type="button" disabled={!canPostToday && Boolean(myAnonymousAlias)} onClick={() => { if(!authenticated) { router.push("/login?returnTo=%2Fplay%2Fmailbox");return; } setCompose((value) => !value); }}><Send size={17}/>{!authenticated ? "로그인하고 사연 보내기" : compose ? "작성 취소" : !canPostToday && myAnonymousAlias ? "오늘의 사연을 이미 보냈어요" : "익명 사연 보내기"}</button>
    {compose && <form className="feature-form" onSubmit={submitPost}><label>제목<input name="title" required maxLength={80} placeholder="제목을 입력하세요"/></label><label>사연<textarea name="content" required maxLength={4000} rows={7} placeholder="사연을 입력하세요"/></label><button type="submit">익명으로 보내기</button></form>}
    {selected && <article className="mailbox-detail"><button className="feature-text-button" type="button" onClick={() => setSelected(null)}>← 목록으로</button><small>익명 {selected.post.authorAlias}</small><h2>{selected.post.title}</h2><p>{selected.post.content}</p><time>{formatDate(selected.post.createdAt)}</time>
      <div className="mailbox-replies"><h3><MessageCircle size={17}/> 익명 답장 {selected.comments.length}</h3>{selected.comments.map((comment) => <div key={comment.id}><strong>익명 {comment.authorAlias}</strong><p>{comment.content}</p><time>{formatDate(comment.createdAt)}</time></div>)}</div>
      <div className="mailbox-reply-form"><strong>답장 선택</strong><small>{authenticated ? "한 번 보낼 수 있으며, 다른 문구를 누르면 변경됩니다." : "답장을 보내려면 로그인해 주세요."}</small><div>{mailboxReplies.map(([value,label,emoji]) => <button className={selected.myReplyType === value ? "selected" : ""} key={value} type="button" disabled={replyPending || selected.myReplyType === value} onClick={() => { if(!authenticated) { router.push(`/login?returnTo=${encodeURIComponent("/play/mailbox")}`);return; } void sendReply(value); }}><span>{emoji}</span>{label}{selected.myReplyType === value && <b>보낸 답장</b>}</button>)}</div></div>
    </article>}
    {!selected && <div className="mailbox-list">{loading ? <div className="feature-loading">불러오는 중...</div> : posts.length ? posts.map((post) => <button type="button" key={post.id} onClick={() => void openPost(post.id)}><span className="mail-stamp">익명<br/>{post.authorAlias}</span><span><strong title={post.title}>{displayPostTitle(post.title)}</strong><p>{post.content}</p><small>{formatDate(post.createdAt)} · 답장 {post.commentCount}</small></span><ArrowRight size={17}/></button>) : <div className="feature-empty">등록된 사연이 없습니다.</div>}</div>}
    {!selected && <nav className="feature-pagination" aria-label="다담 우체통 페이지"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1,value - 1))}><ChevronLeft size={18}/></button>{mailboxPageNumbers(page,totalPages).map((number) => <button type="button" className={number === page ? "active" : ""} key={number} onClick={() => setPage(number)}>{number}</button>)}<button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages,value + 1))}><ChevronRight size={18}/></button></nav>}
    {error && <p className="feature-error">{error}</p>}
  </section>;
}

type TasteDimension = "neuroticism" | "extraversion" | "openness" | "agreeableness" | "conscientiousness";
type TasteQuestion = { id: string; dimension: TasteDimension; question: string; options: Array<{ label: string; score: number }> };
const dimensionLabels: Record<TasteDimension,[string,string]> = {
  neuroticism:["정서적 안정","민감한 감지"], extraversion:["내향적 몰입","외향적 활력"], openness:["익숙한 현실","새로운 탐색"],
  agreeableness:["독립적 판단","협력과 배려"], conscientiousness:["유연한 대응","계획과 완수"],
};
type KakaoWindow = Window & { Kakao?: { isInitialized: () => boolean; init: (key: string) => void; Share: { sendDefault: (settings: Record<string, unknown>) => void } } };

export function TasteLab({ kakaoJavascriptKey,authenticated }: { kakaoJavascriptKey:string;authenticated:boolean }) {
  const redirectLogin = useLoginRedirect();
  const [questions,setQuestions] = useState<TasteQuestion[]>([]); const [loading,setLoading] = useState(true); const [error,setError] = useState("");
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<Array<{ questionId:string; score:number }>>([]); const [finalScores, setFinalScores] = useState<Record<TasteDimension,number> | null>(null); const [notice, setNotice] = useState("");
  const [saved,setSaved] = useState(false); const [actionPending,setActionPending] = useState(false);
  const loadQuestions = useCallback(() => { setLoading(true); setError(""); return apiRequest<{ questions:TasteQuestion[] }>("/api/features/taste").then((data) => setQuestions(data.questions)).catch((caught) => setError(caught instanceof Error ? caught.message : "취향 문항을 불러오지 못했습니다.")).finally(() => setLoading(false)); },[]);
  useEffect(() => { let active = true; void apiRequest<{ questions:TasteQuestion[] }>("/api/features/taste").then((data) => { if (active) setQuestions(data.questions); }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "취향 문항을 불러오지 못했습니다."); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; },[]);
  async function answer(score: number) {
    const next = [...answers, { questionId:questions[step].id,score }]; setAnswers(next);
    if (step < questions.length - 1) { setStep(step + 1); return; }
    try { const data = await apiRequest<{ scores:Record<TasteDimension,number> }>("/api/features/taste", { method: "POST", body: JSON.stringify({ action:"analyze",answers: next }) }); setFinalScores(data.scores); setSaved(false); setNotice(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "결과를 분석하지 못했습니다."); }
  }
  async function saveResult(showNotice = true) {
    if (saved) return true;
    setActionPending(true); setNotice("");
    try {
      await apiRequest("/api/features/taste", { method:"POST", body:JSON.stringify({ action:"save",answers }) });
      setSaved(true); if (showNotice) setNotice("취향 결과를 저장했어요."); return true;
    } catch (caught) {
      if (!redirectLogin(caught)) setNotice(caught instanceof Error ? caught.message : "결과를 저장하지 못했습니다.");
      return false;
    } finally { setActionPending(false); }
  }
  async function shareResult() {
    if (!profile || (authenticated && !(await saveResult(false)))) return;
    try {
      if (!kakaoJavascriptKey) throw new Error("KAKAO_KEY_MISSING");
      const kakao = await loadKakaoSdk(kakaoJavascriptKey);
      const url = `${window.location.origin}/play/taste`;
      kakao.Share.sendDefault({ objectType:"feed",content:{ title:`나의 생활 취향 · ${profile.name}`,description:profile.summary,imageUrl:`${window.location.origin}/share-image`,imageWidth:800,imageHeight:400,link:{ mobileWebUrl:url,webUrl:url } },buttons:[{ title:"나도 취향 발견하기",link:{ mobileWebUrl:url,webUrl:url } }] });
      setNotice("카카오톡 공유 화면을 열었어요.");
    } catch { setNotice("카카오톡 공유를 열지 못했습니다. 잠시 후 다시 시도해 주세요."); }
  }
  function reset() { setStep(0); setAnswers([]); setFinalScores(null); setNotice(""); setSaved(false); void loadQuestions(); }
  const profile = finalScores ? buildTasteProfile(finalScores) : null;
  const current = questions[step];
  return <section className="dadam-feature-page taste-page"><FeatureHero icon={Sparkles} eyebrow="취향 테스트" title="취향 발견실" description="10개 문항으로 취향을 확인해요."/>
    {loading ? <div className="feature-loading">취향 문항을 준비하고 있어요.</div> : error ? <div className="feature-empty">{error}<button type="button" onClick={() => void loadQuestions()}>다시 불러오기</button></div> : !profile || !finalScores ? current && <article className="taste-card"><div className="taste-progress"><i style={{ width: `${(step + 1) / questions.length * 100}%` }}/></div><small>{step + 1} / {questions.length}</small><h2>{current.question}</h2><div>{current.options.map((option) => <button type="button" key={option.label} onClick={() => void answer(option.score)}><span>{option.label}</span><ArrowRight size={19}/></button>)}</div></article> : <article className="taste-result"><span>{profile.emoji}</span><small>나의 생활 취향</small><h2>{profile.name}</h2><p>{profile.summary}</p><div className="taste-analysis">{(Object.keys(finalScores) as TasteDimension[]).map((dimension) => { const max = 4; const percent = Math.round((finalScores[dimension] + max) / (max * 2) * 100); return <div key={dimension}><span>{dimensionLabels[dimension][0]}</span><i><b style={{ width: `${percent}%` }}/></i><span>{dimensionLabels[dimension][1]}</span></div>; })}</div><div className="taste-detail"><section><strong>잘 맞는 일상</strong><p>{profile.fit}</p></section><section><strong>나만의 강점</strong><p>{profile.strength}</p></section><section><strong>균형을 위한 제안</strong><p>{profile.tip}</p></section></div><div className="taste-result-actions"><button type="button" disabled={saved || actionPending} onClick={() => void saveResult()}><Save size={18}/>{saved ? "저장 완료" : actionPending ? "저장 중..." : authenticated ? "결과 저장" : "로그인하고 저장"}</button><button type="button" disabled={actionPending} onClick={() => void shareResult()}><Share2 size={18}/>카카오톡 공유</button></div><button className="taste-retry" type="button" onClick={reset}><RefreshCw size={18}/> 다시 해보기</button>{notice && <em>{notice}</em>}</article>}
  </section>;
}

function buildTasteProfile(scores: Record<TasteDimension,number>) {
  const dominant = (Object.keys(scores) as TasteDimension[]).sort((a,b) => Math.abs(scores[b]) - Math.abs(scores[a]))[0];
  const high = (dimension:TasteDimension) => scores[dimension] > 0;
  const dominantTitles: Record<TasteDimension,string> = { neuroticism:"섬세한 감지자",extraversion:"활력 있는 연결자",openness:"호기심 많은 탐색가",agreeableness:"다정한 조율자",conscientiousness:"꾸준한 완성가" };
  return {
    emoji: dominant === "openness" ? "🧭" : dominant === "extraversion" ? "🤝" : dominant === "agreeableness" ? "🌿" : dominant === "conscientiousness" ? "🗓️" : "🫧",
    name: dominantTitles[dominant],
    summary: `${high("openness") ? "새로운 관점과 경험을 탐색하는 힘" : "익숙한 방식에서 안정적으로 답을 찾는 힘"}이 있고, ${high("extraversion") ? "사람과 활동 속에서 에너지를 얻는 편" : "혼자 깊게 몰입하며 에너지를 회복하는 편"}입니다. ${high("agreeableness") ? "상대의 마음과 협력을 중요하게 여기며" : "필요할 때는 독립적인 기준을 분명히 세우며"}, ${high("conscientiousness") ? "계획한 일을 끝까지 완성하려는 경향" : "변화에 맞춰 유연하게 움직이는 경향"}이 나타납니다.`,
    fit: `${high("openness") ? "배움과 변화가 있는 환경" : "역할과 기준이 분명한 환경"}에서 ${high("extraversion") ? "사람들과 아이디어를 나눌 기회" : "방해받지 않고 집중할 시간"}가 주어질 때 만족도가 높습니다.`,
    strength: `${high("agreeableness") ? "관계를 부드럽게 조율하는 공감력" : "주변 분위기에 휩쓸리지 않는 판단력"}과 ${high("conscientiousness") ? "약속을 실행으로 옮기는 꾸준함" : "예상 밖 상황에 빠르게 적응하는 유연성"}이 강점입니다.`,
    tip: `${high("neuroticism") ? "감정을 빨리 알아차리는 만큼 회복 시간을 일정에 먼저 확보해 보세요." : "침착함이 강점이지만 중요한 감정 신호를 지나치지 않도록 잠깐씩 상태를 확인해 보세요."} 결과는 우열이 아니라 현재 자주 사용하는 성향의 조합입니다.`,
  };
}

type Treasure = { id: string; title: string; treasureType: string; description: string; address: string; roadAddress: string | null; kakaoPlaceId: string | null; placeUrl: string | null; latitude: number | null; longitude: number | null; isMine: boolean; authorName: string; authorStampEmoji: string | null; likeCount:number; likedByMe:boolean; createdAt: string };
const treasureTypes = { walk: "산책", food: "먹거리", pet: "반려동물", rest: "쉼터", photo: "사진 명소", helpful: "생활 정보" } as const;
const treasureTypeIcons = { walk:Footprints,food:Utensils,pet:PawPrint,rest:Trees,photo:Camera,helpful:Lightbulb } as const;

export function TreasureMap({ kakaoJavascriptKey,authenticated }:{ kakaoJavascriptKey:string;authenticated:boolean }) {
  const router=useRouter(); const redirectLogin = useLoginRedirect(); const [items, setItems] = useState<Treasure[]>([]); const [selected, setSelected] = useState<Treasure | null>(null); const [compose, setCompose] = useState(false); const [editing, setEditing] = useState<Treasure | null>(null); const [place, setPlace] = useState<KakaoPlace | null>(null); const [error, setError] = useState(""); const [pendingLikes,setPendingLikes]=useState<string[]>([]);
  const [page,setPage] = useState(1); const [totalPages,setTotalPages] = useState(1); const [totalItems,setTotalItems] = useState(0); const [loading,setLoading] = useState(true);
  const load = useCallback((targetPage:number) => apiRequest<{ treasures: Treasure[];page:number;totalPages:number;totalItems:number }>(`/api/features/treasures?page=${targetPage}`).then((data) => { setItems(data.treasures); setPage(data.page); setTotalPages(data.totalPages); setTotalItems(data.totalItems); setSelected(null); }).catch((caught) => setError(caught instanceof Error ? caught.message : "동네 보물을 불러오지 못했습니다.")).finally(() => setLoading(false)),[]);
  useEffect(() => { void load(page); }, [load,page]);
  function changePage(targetPage:number) { setLoading(true); setError(""); setPage(targetPage); }
  function openCreate() { if(!authenticated) { router.push("/login?returnTo=%2Fplay%2Ftreasures");return; } setEditing(null);setPlace(null);setCompose(true);setError(""); }
  function openEdit(item:Treasure) { setEditing(item);setPlace(item.kakaoPlaceId && item.latitude != null && item.longitude != null ? { placeId:item.kakaoPlaceId,name:item.title,address:item.address,roadAddress:item.roadAddress || "",latitude:item.latitude,longitude:item.longitude,placeUrl:item.placeUrl || "" } : null);setCompose(true);setSelected(null);setError(item.kakaoPlaceId ? "" : "기존 장소를 수정하려면 카카오맵 검색 결과에서 위치를 한 번 선택해 주세요.");window.scrollTo({ top:0,behavior:"smooth" }); }
  function closeForm() { setCompose(false);setEditing(null);setPlace(null); }
  async function toggleLike(item:Treasure) {
    if(item.isMine) { setError("본인이 등록한 장소에는 좋아요를 누를 수 없습니다.");return; }
    if(!authenticated) { router.push("/login?returnTo=%2Fplay%2Ftreasures");return; }
    setPendingLikes((current)=>[...current,item.id]);setError("");
    try {
      const result=await apiRequest<{ liked:boolean;likeCount:number }>(`/api/features/treasures/${item.id}/like`,{ method:item.likedByMe?"DELETE":"POST" });
      const update=(current:Treasure)=>current.id===item.id?{...current,likedByMe:result.liked,likeCount:result.likeCount}:current;
      setItems((current)=>current.map(update));setSelected((current)=>current?update(current):current);
    } catch(caught) { if(!redirectLogin(caught)) setError(caught instanceof Error?caught.message:"좋아요를 반영하지 못했습니다."); }
    finally { setPendingLikes((current)=>current.filter((id)=>id!==item.id)); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!place) { setError("카카오맵 검색 결과에서 장소를 선택해 주세요.");return; } const form = new FormData(event.currentTarget); try { await apiRequest("/api/features/treasures", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ id:editing?.id,title: form.get("title"), treasureType: form.get("treasureType"), description: form.get("description"), address:place.address,roadAddress:place.roadAddress,kakaoPlaceId:place.placeId,placeUrl:place.placeUrl,latitude:place.latitude,longitude:place.longitude }) }); closeForm();setLoading(true);await load(page); } catch (caught) { if (!redirectLogin(caught)) setError(caught instanceof Error ? caught.message : `장소를 ${editing ? "수정" : "등록"}하지 못했습니다.`); } }
  return <section className="dadam-feature-page treasure-page"><FeatureHero icon={MapPin} eyebrow="장소 추천" title="동네 보물지도" description="이웃이 등록한 장소를 확인하세요."/>
    <button className="feature-primary-button" type="button" onClick={() => compose ? closeForm() : openCreate()}><MapPin size={17}/>{compose ? "작성 취소" : authenticated ? "동네 보물 등록" : "로그인하고 장소 등록"}</button>
    {compose && <form key={editing?.id || "new"} className="feature-form treasure-form" onSubmit={submit}><h2>{editing ? "내가 등록한 장소 수정" : "새 동네 보물 등록"}</h2><label>장소 이름<input name="title" required maxLength={100} defaultValue={editing?.title || ""}/></label><fieldset className="treasure-type-picker"><legend>유형</legend><div>{Object.entries(treasureTypes).map(([value,label])=>{const Icon=treasureTypeIcons[value as keyof typeof treasureTypeIcons];return <label className="treasure-type-option" key={value}><input type="radio" name="treasureType" value={value} required defaultChecked={(editing?.treasureType || "walk")===value}/><span><i><Icon/><Check className="treasure-type-check"/></i><b>{label}</b></span></label>;})}</div></fieldset><label>카카오맵 장소 선택<KakaoPlacePicker javascriptKey={kakaoJavascriptKey} value={place} onSelect={setPlace}/></label><label>소개<textarea name="description" required maxLength={1000} rows={4} defaultValue={editing?.description || ""}/></label><p className="location-privacy">집 주소처럼 개인을 특정할 수 있는 위치는 등록하지 마세요.</p><button type="submit">{editing ? "수정 내용 저장하기" : "지도에 등록하기"}</button></form>}
    <header className="treasure-list-heading"><div><h2>이웃이 발견한 장소</h2><p>장소를 선택하면 위치와 자세한 이야기를 볼 수 있어요.</p></div><strong>{totalItems.toLocaleString()}곳</strong></header>
    {selected && selected.latitude != null && selected.longitude != null && <div className="treasure-map-frame"><KakaoPlaceViewer javascriptKey={kakaoJavascriptKey} place={{ name:selected.title,latitude:selected.latitude,longitude:selected.longitude,placeUrl:selected.placeUrl || "" }}/></div>}
    {loading ? <div className="feature-loading">동네의 보물을 찾고 있어요.</div> : <div className="treasure-list">{items.map((item) => <article key={item.id} className={selected?.id === item.id ? "selected" : ""}><button type="button" className="treasure-open" onClick={() => setSelected((current) => current?.id === item.id ? null : item)}><b>{treasureTypes[item.treasureType as keyof typeof treasureTypes] || "장소"}</b><strong>{item.title}</strong><p>{item.description}</p><span><MapPin size={13}/>{item.roadAddress || item.address}</span><small><StampedName full name={item.authorName} stamp={item.authorStampEmoji} /> · {formatDate(item.createdAt)}</small><em>{selected?.id === item.id ? "지도 닫기" : "지도 보기"}</em></button><button className={`treasure-like ${item.likedByMe?"liked":""}`} type="button" disabled={item.isMine||pendingLikes.includes(item.id)} aria-pressed={item.likedByMe} aria-label={`${item.title} 좋아요 ${item.likeCount}개`} title={item.isMine?"내 장소의 좋아요 수":item.likedByMe?"좋아요 취소":"좋아요"} onClick={()=>void toggleLike(item)}><Heart size={15} fill={item.likedByMe?"currentColor":"none"}/><span>좋아요</span><strong>{item.likeCount.toLocaleString()}</strong></button>{item.isMine && <button className="treasure-edit" type="button" onClick={() => openEdit(item)}><Pencil size={14}/>수정</button>}</article>)}</div>}
    {!loading && !items.length && <div className="feature-empty">아직 등록된 동네 보물이 없습니다.</div>}
    {!loading && items.length > 0 && <nav className="feature-pagination" aria-label="동네 보물지도 페이지"><button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)}><ChevronLeft size={18}/></button>{mailboxPageNumbers(page,totalPages).map((number) => <button type="button" className={number === page ? "active" : ""} key={number} onClick={() => changePage(number)}>{number}</button>)}<button type="button" disabled={page >= totalPages} onClick={() => changePage(page + 1)}><ChevronRight size={18}/></button></nav>}
    {error && <p className="feature-error">{error}</p>}
  </section>;
}

async function loadKakaoSdk(javascriptKey: string) {
  const kakaoWindow = window as KakaoWindow;
  if (!kakaoWindow.Kakao) {
    await new Promise<void>((resolve,reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-sdk="true"]');
      if (existing) { existing.addEventListener("load",() => resolve(),{ once:true }); existing.addEventListener("error",() => reject(new Error("KAKAO_SDK_FAILED")),{ once:true }); return; }
      const script = document.createElement("script");
      script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.5/kakao.min.js";
      script.integrity = "sha384-v6JKY3z4FUkWq21oZDHZe74YvuPk/WUrVLrDHTBojHXClOSa3iXy7sCXPY1jkFbj";
      script.crossOrigin = "anonymous"; script.async = true; script.dataset.kakaoSdk = "true";
      script.onload = () => resolve(); script.onerror = () => reject(new Error("KAKAO_SDK_FAILED")); document.head.appendChild(script);
    });
  }
  if (!kakaoWindow.Kakao) throw new Error("KAKAO_SDK_FAILED");
  if (!kakaoWindow.Kakao.isInitialized()) kakaoWindow.Kakao.init(javascriptKey);
  return kakaoWindow.Kakao;
}

type RandomPost = { id: string; title: string; authorName: string; authorStampEmoji: string | null; categoryName: string; viewCount: number; commentCount: number; createdAt: string };
export function RandomJourney() {
  const [post, setPost] = useState<RandomPost | null>(null); const [category, setCategory] = useState(""); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function travel() { setLoading(true); setError(""); try { const data = await apiRequest<{ post: RandomPost | null }>(`/api/features/random-story${category ? `?category=${encodeURIComponent(category)}` : ""}`); setPost(data.post); } catch (caught) { setError(caught instanceof Error ? caught.message : "이야기를 찾지 못했습니다."); } finally { setLoading(false); } }
  return <section className="dadam-feature-page random-page"><FeatureHero icon={Compass} eyebrow="무작위 게시글" title="랜덤 이야기 여행" description="게시글 하나를 무작위로 보여드려요."/>
    <article className="random-machine"><label>여행할 게시판<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">모든 게시판</option>{categories.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label><button type="button" onClick={() => void travel()} disabled={loading}><Compass size={20}/>{loading ? "이야기를 찾는 중..." : post ? "다른 이야기 만나기" : "랜덤 여행 시작"}</button></article>
    {post && <Link className="random-story-card" href={`/posts/${post.id}`}><small>{post.categoryName}</small><h2 title={post.title}>{displayPostTitle(post.title)}</h2><PostListMeta className="random-story-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/><b>이야기 읽기 <ArrowRight size={16}/></b></Link>}
    {!post && !loading && <div className="random-orbit"><i/><span>?</span><p>어떤 이야기를 만나게 될까요?</p></div>}{error && <p className="feature-error">{error}</p>}
  </section>;
}

function formatDate(value: string) { return new Date(value).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function mailboxPageNumbers(page: number,totalPages: number) { const start = Math.max(1,Math.min(page - 1,totalPages - 2)); const end = Math.min(totalPages,start + 2); return Array.from({ length: end - start + 1 },(_,index) => start + index); }
