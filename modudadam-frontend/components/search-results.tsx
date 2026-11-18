"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { getAnonymousId } from "@/lib/anonymous-id";
import { categories } from "@/lib/categories";
import { StampedName } from "@/components/stamped-name";

type SearchPost = {
  id: string; title: string; excerpt: string; authorName: string; authorStampEmoji: string | null;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number; createdAt: string;
};
type Pagination = { page: number; pageSize: number; totalItems: number; totalPages: number };

export function SearchResults({ initialQuery, hideForm = false }: { initialQuery: string; hideForm?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 20, totalItems: 0, totalPages: 1 });
  const [loading, setLoading] = useState(Boolean(initialQuery));
  const [error, setError] = useState("");
  const requestedQuery = useRef("");

  useEffect(() => {
    if (!initialQuery) return;
    const requestKey = `${initialQuery}:${category}:${page}`;
    requestedQuery.current = requestKey;
    const params = new URLSearchParams({ q: initialQuery, page: String(page), limit: "20" });
    if (category) params.set("category", category);
    apiRequest<{ posts: SearchPost[]; pagination: Pagination }>(`/api/posts?${params}`)
      .then((result) => { if (requestedQuery.current === requestKey) { setPosts(result.posts); setPagination(result.pagination); setError(""); } })
      .catch((caught) => { if (requestedQuery.current === requestKey) setError(caught instanceof Error ? caught.message : "검색 결과를 불러오지 못했습니다."); })
      .finally(() => { if (requestedQuery.current === requestKey) setLoading(false); });
  }, [category, initialQuery, page]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    await apiRequest("/api/searches", { method: "POST", body: JSON.stringify({ query: normalized, anonymousId: getAnonymousId() }) }).catch(() => undefined);
    router.push(`/search?q=${encodeURIComponent(normalized)}`);
  }

  function selectCategory(nextCategory: string) {
    if (nextCategory === category) return;
    setCategory(nextCategory);
    setPage(1);
    setPosts([]);
    setLoading(true);
  }

  function movePage(nextPage: number) {
    if (nextPage === page || nextPage < 1 || nextPage > pagination.totalPages) return;
    setPage(nextPage);
    setPosts([]);
    setLoading(true);
  }

  return <>
    {!hideForm && <form className="search-form" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value.slice(0, 80))} placeholder="생활 정보와 이야기를 검색하세요"/><button>검색</button></form>}
    {initialQuery && <section className="search-result-section">
      <div className="section-heading"><h2><b>&lsquo;{initialQuery}&rsquo;</b> 검색 결과</h2><span>{loading ? "검색 중" : `${pagination.totalItems}건`}</span></div>
      <nav className="search-category-tabs" aria-label="검색 결과 게시판 선택">
        <button type="button" className={category === "" ? "active" : ""} onClick={() => selectCategory("")}>전체</button>
        {categories.map((item) => <button type="button" key={item.code} className={category === item.code ? "active" : ""} onClick={() => selectCategory(item.code)}>{item.name}</button>)}
      </nav>
      {error && <div className="board-message error">{error}</div>}
      {!loading && !error && posts.length === 0 && <div className="board-message">일치하는 게시글이 없습니다.</div>}
      {posts.length > 0 && <div className="board-list search-result-list">{posts.map((post) => <Link href={`/posts/${post.id}`} className="board-row board-row-dense" key={post.id}>
        <div className="board-row-main"><small>{post.categoryName}</small><div className="board-row-title">{post.title}</div></div>
        <div className="board-row-meta"><StampedName className="board-author" name={post.authorName} stamp={post.authorStampEmoji} /><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time><span><Eye size={13}/>{post.viewCount}</span><span><MessageCircle size={13}/>{post.commentCount}</span></div>
      </Link>)}</div>}
      {!loading && !error && pagination.totalPages > 1 && <nav className="search-pagination" aria-label="검색 결과 페이지">
        <button type="button" onClick={() => movePage(page - 1)} disabled={page <= 1} aria-label="이전 페이지"><ChevronLeft size={15}/></button>
        {pageNumbers(page, pagination.totalPages).map((number) => <button type="button" key={number} className={number === page ? "active" : ""} aria-current={number === page ? "page" : undefined} onClick={() => movePage(number)}>{number}</button>)}
        <button type="button" onClick={() => movePage(page + 1)} disabled={page >= pagination.totalPages} aria-label="다음 페이지"><ChevronRight size={15}/></button>
      </nav>}
    </section>}
  </>;
}

function pageNumbers(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
}

function formatDate(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date.getMonth() + 1}.${date.getDate()}`;
}
