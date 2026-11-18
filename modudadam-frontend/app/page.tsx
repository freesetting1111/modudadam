import Link from "next/link";
import { ChevronRight, Eye, MessageCircle } from "lucide-react";
import { HomeSearch } from "@/components/home-search";
import { CategoryPostCarousels } from "@/components/weekly-hot-carousel";
import { categories } from "@/lib/categories";
import { API_SERVER_URL } from "@/lib/server-config";
import { StampedName } from "@/components/stamped-name";

export type HomePost = {
  id: string; title: string; excerpt: string; authorName: string; authorStampEmoji: string | null;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number; createdAt: string;
};

export default async function Home() {
  const [weeklyPosts, categoryPosts] = await Promise.all([getWeeklyPostsByCategory(), getCategoryPosts()]);
  const weeklyGroups = categories.map((category) => ({
    categoryCode: category.code,
    posts: weeklyPosts.filter((post) => post.categoryCode === category.code).slice(0, 5),
  }));
  const latestGroups = categories.map((category) => ({
    categoryCode: category.code,
    posts: categoryPosts.filter((post) => post.categoryCode === category.code).slice(0, 5),
  }));
  const categoryFeeds = categories.map((category) => ({
    category,
    posts: categoryPosts.filter((post) => post.categoryCode === category.code).slice(0, 10),
  }));

  return <div className="community-home">
    <HomeSearch />

    <section className="community-dashboard community-dashboard-stacked" aria-label="커뮤니티 주요 게시글">
      <CategoryPostCarousels hotGroups={weeklyGroups} latestGroups={latestGroups} />
    </section>

    <section className="board-directory">
      <div className="directory-heading"><div><h2>주제별 게시판</h2><p>관심 있는 게시판의 새 글을 바로 확인하세요.</p></div><span>{categories.length}개</span></div>
      <div className="board-card-grid">{categoryFeeds.map(({ category, posts }) => {
        const Icon = category.icon;
        return <article className="board-preview-card" key={category.code}>
          <header><Link href={`/category/${category.code}`}><span className={`board-preview-icon category-${category.code}`}><Icon size={16} /></span><strong>{category.name}</strong><ChevronRight size={14} /></Link></header>
          <div>{posts.length > 0 ? posts.map((post) => <Link className="board-preview-post" href={`/posts/${post.id}`} key={post.id}>
            <span className="board-preview-title">{post.title}</span>
            <span className="board-preview-meta"><StampedName name={post.authorName} stamp={post.authorStampEmoji} /><time dateTime={post.createdAt}>{formatCompactDate(post.createdAt)}</time><span><Eye size={10}/>{post.viewCount}</span><span><MessageCircle size={10}/>{post.commentCount}</span></span>
          </Link>) : <Link className="board-preview-empty" href={`/category/${category.code}/write`}>등록된 게시글이 없습니다.</Link>}</div>
        </article>;
      })}</div>
    </section>
  </div>;
}

async function getWeeklyPostsByCategory(): Promise<HomePost[]> {
  try {
    const params = new URLSearchParams({ weeklyByCategory: "true", perCategory: "5" });
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

function formatCompactDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date.getMonth() + 1}.${date.getDate()}`;
}
