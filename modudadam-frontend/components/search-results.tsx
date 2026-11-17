"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { Eye, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type SearchPost = {
  id: string; title: string; excerpt: string; authorName: string;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number; createdAt: string;
};

export function SearchResults({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!initialQuery) return;
    let active = true;
    apiRequest<{ posts: SearchPost[] }>(`/api/posts?q=${encodeURIComponent(initialQuery)}&limit=20`)
      .then((result) => { if (active) { setPosts(result.posts); setError(""); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "검색 결과를 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialQuery]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    await apiRequest("/api/searches", { method: "POST", body: JSON.stringify({ query: normalized }) }).catch(() => undefined);
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  return <>
    <form className="search-form" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 80))} placeholder="생활 정보와 이야기를 검색하세요"/><button>검색</button></form>
    {initialQuery && <section className="search-result-section">
      <div className="section-heading"><h2><b>&lsquo;{initialQuery}&rsquo;</b> 검색 결과</h2><span>{loading ? "검색 중" : `${posts.length}건`}</span></div>
      {error && <div className="board-message error">{error}</div>}
      {!loading && !error && posts.length === 0 && <div className="board-message">일치하는 게시글이 없습니다.</div>}
      {posts.length > 0 && <div className="board-list search-result-list">{posts.map((post) => <Link href={`/posts/${post.id}`} className="board-row board-row-dense" key={post.id}>
        <div className="board-row-main"><small>{post.categoryName}</small><div className="board-row-title">{post.title}</div>{post.excerpt && <p>{post.excerpt}</p>}</div>
        <div className="board-row-meta"><span className="board-author">{post.authorName}</span><span><Eye size={13}/>{post.viewCount}</span><span><MessageCircle size={13}/>{post.commentCount}</span></div>
      </Link>)}</div>}
    </section>}
  </>;
}
