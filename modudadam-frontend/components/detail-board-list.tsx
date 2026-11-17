"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, MessageCircle, PenLine } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { findCategory } from "@/lib/categories";

type Post = {
  id: string; title: string; excerpt: string; authorName: string; viewCount: number; commentCount: number;
  createdAt: string; isNotice: boolean; isPinned: boolean;
};
type PageData = {
  posts: Post[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

const PAGE_SIZE = 10;

export function DetailBoardList({ categoryCode, currentPostId, authenticated }: { categoryCode: string; currentPostId: string; authenticated: boolean }) {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestedListKey = useRef("");

  const load = useCallback(async (page?: number) => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ category: categoryCode, sort: "latest", limit: String(PAGE_SIZE), currentPostId });
      if (page) params.set("page", String(page));
      setData(await apiRequest<PageData>(`/api/posts?${params}`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "게시글 목록을 불러오지 못했습니다.");
    } finally { setLoading(false); }
  }, [categoryCode, currentPostId]);

  useEffect(() => {
    const requestKey = `${categoryCode}:${currentPostId}`;
    if (requestedListKey.current === requestKey) return;
    requestedListKey.current = requestKey;
    const params = new URLSearchParams({ category: categoryCode, sort: "latest", limit: String(PAGE_SIZE), currentPostId });
    void apiRequest<PageData>(`/api/posts?${params}`)
      .then((result) => { if (requestedListKey.current === requestKey) { setData(result); setError(""); } })
      .catch((caught) => { if (requestedListKey.current === requestKey) setError(caught instanceof Error ? caught.message : "게시글 목록을 불러오지 못했습니다."); })
      .finally(() => { if (requestedListKey.current === requestKey) setLoading(false); });
  }, [categoryCode, currentPostId]);

  const pagination = data?.pagination;
  const page = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 1;
  const firstPage = Math.max(1, Math.min(page - 4, totalPages - 9));
  const pages = Array.from({ length: Math.min(10, totalPages) }, (_, index) => firstPage + index);
  const category = findCategory(categoryCode);
  if (!category) return null;
  const Icon = category.icon;

  return <section className="detail-board-section board-page">
    <div className="category-hero"><span className={`category-icon category-icon-large category-${category.code}`}><Icon size={27} strokeWidth={1.8} /></span><div><small>커뮤니티</small><h1>{category.name}</h1><p>{category.description}</p></div></div>
    {authenticated && <div className="board-toolbar board-toolbar-compact board-toolbar-write-only"><Link className="write-button" href={`/category/${categoryCode}/write`}><PenLine size={14} /> 글쓰기</Link></div>}
    {loading && !data && <div className="board-message">게시글을 불러오고 있어요.</div>}
    {error && <div className="board-message error">{error}</div>}
    {data && <div className="board-list" aria-busy={loading}>{data.posts.map((post) => <Link key={post.id} href={`/posts/${post.id}`} className={`board-row board-row-dense ${post.id === currentPostId ? "board-row-current" : ""}`} aria-current={post.id === currentPostId ? "page" : undefined}>
      <div className="board-row-main"><div className="board-row-title">{(post.isNotice || post.isPinned) && <b className="notice-badge">공지</b>}{post.title}</div></div>
      <div className="board-row-meta"><span className="board-author">{post.authorName}</span><time dateTime={post.createdAt}>{formatBoardDate(post.createdAt)}</time><span aria-label={`조회 ${post.viewCount}`}><Eye size={13} /> {post.viewCount}</span><span aria-label={`댓글 ${post.commentCount}`}><MessageCircle size={13} /> {post.commentCount}</span></div>
    </Link>)}</div>}
    {data && <nav className="board-pagination" aria-label="상세 게시판 페이지">
      <button type="button" disabled={page === 1 || loading} onClick={() => void load(page - 1)} aria-label="이전 게시글 페이지"><ChevronLeft size={17} /></button>
      {pages.map((item) => <button type="button" key={item} className={item === page ? "active" : ""} disabled={loading} onClick={() => void load(item)} aria-current={item === page ? "page" : undefined}>{item}</button>)}
      <button type="button" disabled={page === totalPages || loading} onClick={() => void load(page + 1)} aria-label="다음 게시글 페이지"><ChevronRight size={17} /></button>
    </nav>}
  </section>;
}

function formatBoardDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\s/g, "");
}
