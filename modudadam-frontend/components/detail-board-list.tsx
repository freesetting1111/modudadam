"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Sort = "latest" | "popular";
type Post = {
  id: string; title: string; authorName: string; viewCount: number; commentCount: number;
  createdAt: string; isNotice: boolean; isPinned: boolean;
};
type PageData = {
  posts: Post[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

const PAGE_SIZE = 10;

export function DetailBoardList({ categoryCode, currentPostId }: { categoryCode: string; currentPostId: string }) {
  const [sort, setSort] = useState<Sort>("latest");
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextSort: Sort, page?: number) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ category: categoryCode, sort: nextSort, limit: String(PAGE_SIZE), currentPostId });
      if (page) params.set("page", String(page));
      setData(await apiRequest<PageData>(`/api/posts?${params}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "게시글 목록을 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, [categoryCode, currentPostId]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ category: categoryCode, sort, limit: String(PAGE_SIZE), currentPostId });
    void apiRequest<PageData>(`/api/posts?${params}`)
      .then((result) => { if (active) { setData(result); setError(""); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "게시글 목록을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryCode, currentPostId, sort]);

  function changeSort(nextSort: Sort) {
    if (nextSort !== sort) { setLoading(true); setData(null); setSort(nextSort); }
  }

  const pagination = data?.pagination;
  const page = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const firstPage = Math.max(1, Math.min(page - 4, totalPages - 9));
  const pages = Array.from({ length: Math.min(10, totalPages) }, (_, index) => firstPage + index);

  return <section className="detail-board-section">
    <header className="detail-board-header"><h2>전체 글</h2><div><button type="button" className={sort === "latest" ? "active" : ""} onClick={() => changeSort("latest")}>최신순</button><span>|</span><button type="button" className={sort === "popular" ? "active" : ""} onClick={() => changeSort("popular")}>인기순</button></div></header>
    {loading && !data && <div className="detail-board-message">게시글을 불러오고 있어요.</div>}
    {error && <div className="detail-board-message error">{error}</div>}
    {data && <div className="detail-board-rows" aria-busy={loading}>{data.posts.map((post) => <Link key={post.id} href={`/posts/${post.id}`} className={`detail-board-row ${post.id === currentPostId ? "current" : ""}`} aria-current={post.id === currentPostId ? "page" : undefined}>
      <div><small>{post.isNotice || post.isPinned ? "공지" : "일반"}</small><strong>{post.title}</strong><span>{post.authorName}</span></div>
      <div><span><Eye size={12} /> {post.viewCount}</span><span><MessageCircle size={12} /> {post.commentCount}</span><time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time></div>
    </Link>)}</div>}
    {data && <nav className="detail-board-pagination" aria-label="상세 게시판 페이지">
      <button type="button" disabled={page === 1 || loading} onClick={() => void load(sort, page - 1)} aria-label="이전 게시글 페이지"><ChevronLeft size={15} /></button>
      {pages.map((item) => <button type="button" key={item} className={item === page ? "active" : ""} disabled={loading} onClick={() => void load(sort, item)} aria-current={item === page ? "page" : undefined}>{item}</button>)}
      <button type="button" disabled={page === totalPages || loading} onClick={() => void load(sort, page + 1)} aria-label="다음 게시글 페이지"><ChevronRight size={15} /></button>
    </nav>}
  </section>;
}

function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
    : date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".");
}
