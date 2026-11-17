import Link from "next/link";
import { ChevronRight, Clock3, Eye, Flame, MessageCircle } from "lucide-react";
import { HomeSearch } from "@/components/home-search";
import { categories, findCategory } from "@/lib/categories";
import { API_SERVER_URL } from "@/lib/server-config";

type HomePost = {
  id: string; title: string; excerpt: string; authorName: string;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number; createdAt: string;
};

export default async function Home() {
  const [weeklyPosts, latestPosts, categoryPosts] = await Promise.all([getPosts("weekly", 20), getPosts("latest", 20), getCategoryPosts()]);
  const recommendations = dailyMix(weeklyPosts).slice(0, 3);
  const categoryFeeds = categories.map((category) => ({
    category,
    posts: categoryPosts.filter((post) => post.categoryCode === category.code).slice(0, 10),
  }));

  return <div className="community-home">
    <HomeSearch />

    <section className={`community-dashboard ${recommendations.length === 0 ? "single-panel" : ""}`} aria-label="커뮤니티 주요 게시글">
      {recommendations.length > 0 && <article className="community-panel hot-panel">
        <header><h1><Flame size={17} /> 주간 인기</h1><span>최근 7일</span></header>
        <div className="portal-post-list">{recommendations.map((post, index) => <PortalPost key={post.id} post={post} rank={index + 1} showCategory />)}</div>
      </article>}
      <article className="community-panel latest-panel">
        <header><h2><Clock3 size={16} /> 새로 올라온 글</h2><span>실시간 최신</span></header>
        <div className="portal-post-list">
          {latestPosts.length > 0 ? latestPosts.slice(0, 10).map((post) => <PortalPost key={post.id} post={post} />) : <PanelEmpty />}
        </div>
      </article>
    </section>

    <section className="board-directory">
      <div className="directory-heading"><div><h2>주제별 게시판</h2><p>관심 있는 게시판의 새 글을 바로 확인하세요.</p></div><span>{categories.length}개</span></div>
      <div className="board-card-grid">{categoryFeeds.map(({ category, posts }) => {
        const Icon = category.icon;
        return <article className="board-preview-card" key={category.code}>
          <header><Link href={`/category/${category.code}`}><span className={`board-preview-icon category-${category.code}`}><Icon size={16} /></span><strong>{category.name}</strong><ChevronRight size={14} /></Link></header>
          <div>{posts.length > 0 ? posts.map((post) => <Link className="board-preview-post" href={`/posts/${post.id}`} key={post.id}>
            <span className="board-preview-title">{post.title}</span>
            <span className="board-preview-meta"><span>{post.authorName}</span><time dateTime={post.createdAt}>{formatCompactDate(post.createdAt)}</time><span><Eye size={10}/>{post.viewCount}</span><span><MessageCircle size={10}/>{post.commentCount}</span></span>
          </Link>) : <Link className="board-preview-empty" href={`/category/${category.code}/write`}>첫 이야기를 남겨보세요</Link>}</div>
        </article>;
      })}</div>
    </section>
  </div>;
}

function PortalPost({ post, rank, showCategory = false }: { post: HomePost; rank?: number; showCategory?: boolean }) {
  const category = findCategory(post.categoryCode);
  return <Link href={`/posts/${post.id}`} className="portal-post-row">
    {rank && <strong className="portal-rank">{rank}</strong>}
    <div className="portal-post-title">{showCategory && <small>{category?.short || post.categoryName}</small>}<span>{post.title}</span>{post.commentCount > 0 && <b>{post.commentCount}</b>}</div>
    <time dateTime={post.createdAt}>{formatCompactDate(post.createdAt)}</time>
  </Link>;
}

function PanelEmpty() {
  return <div className="panel-empty"><MessageCircle size={16} /><span>아직 등록된 글이 없습니다.</span></div>;
}

async function getPosts(sort: "latest" | "weekly", limit: number): Promise<HomePost[]> {
  try {
    const params = new URLSearchParams({ sort, limit: String(limit) });
    const response = await fetch(`${API_SERVER_URL}/api/posts?${params}`, { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const body = await response.json() as { success?: boolean; data?: { posts?: HomePost[] } };
    return body.success && Array.isArray(body.data?.posts) ? body.data.posts : [];
  } catch { return []; }
}

async function getCategoryPosts(): Promise<HomePost[]> {
  try {
    const params = new URLSearchParams({ groupedByCategory: "true", perCategory: "10" });
    const response = await fetch(`${API_SERVER_URL}/api/posts?${params}`, { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const body = await response.json() as { success?: boolean; data?: { posts?: HomePost[] } };
    return body.success && Array.isArray(body.data?.posts) ? body.data.posts : [];
  } catch { return []; }
}

function dailyMix(posts: HomePost[]) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  return [...posts].sort((a, b) => stableScore(`${day}:${a.id}`) - stableScore(`${day}:${b.id}`));
}

function stableScore(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return hash >>> 0;
}

function formatCompactDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date.getMonth() + 1}.${date.getDate()}`;
}
