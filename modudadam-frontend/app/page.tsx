import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronRight, Sparkles, TrendingUp } from "lucide-react";
import { HomeSearch } from "@/components/home-search";
import { HomeBoardExplorer } from "@/components/home-board-explorer";
import { CategoryPostCarousels } from "@/components/weekly-hot-carousel";
import { categories, communityBoardChoices, specialBoards } from "@/lib/categories";
import { API_SERVER_URL } from "@/lib/server-config";
import { PostListMeta } from "@/components/post-list-meta";
import { WeeklyReputationRankings } from "@/components/weekly-reputation-rankings";
import { displayPostTitle } from "@/lib/post-display";

export type HomePost = {
  id: string; title: string; excerpt: string; authorName: string; authorStampEmoji: string | null;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number; createdAt: string;
  isRead: boolean;
};

export default async function Home() {
  const cookieHeader=(await cookies()).toString();
  const [weeklyPosts, categoryPosts] = await Promise.all([getWeeklyPostsByCategory(cookieHeader), getCategoryPosts(cookieHeader)]);
  const weeklyGroups = categories.map((category) => ({
    categoryCode: category.code,
    posts: weeklyPosts.filter((post) => post.categoryCode === category.code).slice(0, 5),
  }));
  const latestGroups = categories.map((category) => ({
    categoryCode: category.code,
    posts: categoryPosts.filter((post) => post.categoryCode === category.code).slice(0, 5),
  }));
  const specialBoardFeeds = specialBoards.filter((category) => category.code !== "anonymous").map((category) => ({
    category,
    posts: categoryPosts.filter((post) => post.categoryCode === category.code).slice(0, 3),
  }));

  return <div className="community-home">
    <HomeSearch />

    <section className="home-special-board-section" aria-label="공지사항과 자유게시판">
      <div className="board-card-grid">{specialBoardFeeds.map(({ category, posts }) => <BoardPreview key={category.code} category={category} posts={posts} slots={3} />)}</div>
    </section>

    <section className="community-dashboard community-dashboard-stacked" aria-label="커뮤니티 주요 게시글">
      <header className="home-feature-heading">
        <span><TrendingUp size={20}/></span>
        <div><small>DISCOVER THIS WEEK</small><h2>지금 사람들이 모이는 이야기</h2><p>이번 주에 많이 읽힌 글과 방금 올라온 새 이야기를 만나보세요.</p></div>
      </header>
      <CategoryPostCarousels hotGroups={weeklyGroups} latestGroups={latestGroups} />
    </section>

    <WeeklyReputationRankings />

    <section className="board-directory">
      <div className="directory-heading"><div><h2><Sparkles size={17}/>주제별 게시판</h2><p>게시판을 골라 최신 글 10개를 확인하세요.</p></div><span>{communityBoardChoices.length}개</span></div>
      <HomeBoardExplorer posts={categoryPosts}/>
    </section>
  </div>;
}
type PreviewBoard = (typeof categories)[number] | (typeof specialBoards)[number];

function BoardPreview({ category, posts, slots }: { category: PreviewBoard; posts: HomePost[]; slots: 3 | 5 }) {
  const Icon = category.icon;
  return <article className={`board-preview-card board-preview-${category.code} board-preview-slots-${slots}`}>
    <header><Link href={`/category/${category.code}`}><span className={`board-preview-icon category-${category.code}`}><Icon size={16} /></span><strong>{category.name}</strong><ChevronRight size={14} /></Link></header>
    <div>{posts.length > 0 ? posts.map((post) => <Link className={`board-preview-post ${post.isRead ? "is-read" : ""}`} href={`/posts/${post.id}`} key={post.id}>
      <span className="board-preview-title" title={post.title}>{displayPostTitle(post.title)}</span>
      <PostListMeta className="board-preview-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/>
    </Link>) : <Link className="board-preview-empty" href={`/category/${category.code}`}>등록된 게시글이 없습니다.</Link>}</div>
  </article>;
}

async function getWeeklyPostsByCategory(cookieHeader:string): Promise<HomePost[]> {
  try {
    const params = new URLSearchParams({ weeklyByCategory: "true", perCategory: "5" });
    const response = await fetch(`${API_SERVER_URL}/api/posts?${params}`, { cache:"no-store",headers:cookieHeader ? { cookie:cookieHeader } : undefined });
    if (!response.ok) return [];
    const body = await response.json() as { success?: boolean; data?: { posts?: HomePost[] } };
    return body.success && Array.isArray(body.data?.posts) ? body.data.posts : [];
  } catch { return []; }
}
async function getCategoryPosts(cookieHeader:string): Promise<HomePost[]> {
  try {
    const params = new URLSearchParams({ groupedByCategory: "true", perCategory: "10" });
    const response = await fetch(`${API_SERVER_URL}/api/posts?${params}`, { cache:"no-store",headers:cookieHeader ? { cookie:cookieHeader } : undefined });
    if (!response.ok) return [];
    const body = await response.json() as { success?: boolean; data?: { posts?: HomePost[] } };
    return body.success && Array.isArray(body.data?.posts) ? body.data.posts : [];
  } catch { return []; }
}
