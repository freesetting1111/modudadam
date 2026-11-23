"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, HandCoins, PenLine } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { findBoard } from "@/lib/categories";
import { PostListMeta } from "@/components/post-list-meta";
import { displayPostTitle } from "@/lib/post-display";

type Post = {
  id: string; title: string; excerpt: string; authorName: string; authorStampEmoji: string | null; viewCount: number; commentCount: number;
  createdAt: string; isNotice: boolean; isPinned: boolean; isRead:boolean;bountyAmount:number;
};
type PageData = {
  posts: Post[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

const PAGE_SIZE = 20;

export function DetailBoardList({ categoryCode, currentPostId, canWrite,writeHref }: { categoryCode: string; currentPostId: string; canWrite: boolean;writeHref?:string }) {
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
  const category = findBoard(categoryCode);
  if (!category) return null;
  const Icon = category.icon;

  return <section className="detail-board-section board-page">
    <div className="category-hero"><span className={`category-icon category-icon-large category-${category.code}`}><Icon size={27} strokeWidth={1.8} /></span><div><small>{categoryCode==="bounty" ? "도움 요청" : "커뮤니티"}</small><h1>{category.name}</h1><p>{category.description}</p></div></div>
    {canWrite && <div className="board-toolbar board-toolbar-compact board-toolbar-write-only"><Link className="write-button" href={writeHref||`/category/${categoryCode}/write`}><PenLine size={14} /> 글쓰기</Link></div>}
    {loading && !data && <div className="board-message">게시글을 불러오고 있어요.</div>}
    {error && <div className="board-message error">{error}</div>}
    {data && <div className="board-list" aria-busy={loading}>{data.posts.map((post) => <Link key={post.id} href={`/posts/${post.id}`} className={`board-row board-row-dense ${post.isRead || post.id === currentPostId ? "is-read" : ""} ${post.id === currentPostId ? "board-row-current" : ""}`} aria-current={post.id === currentPostId ? "page" : undefined}>
      <div className="board-row-main"><div className="board-row-title" title={post.title}>{(post.isNotice || post.isPinned) && <b className="notice-badge">공지</b>}{post.bountyAmount>0&&<b className={`bounty-list-badge bounty-tier-${post.bountyAmount}`}><HandCoins size={12}/>{post.bountyAmount.toLocaleString()}</b>}{displayPostTitle(post.title)}</div></div>
      <PostListMeta className="board-row-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/>
    </Link>)}</div>}
    {data && <nav className="board-pagination" aria-label="상세 게시판 페이지">
      <button type="button" disabled={page === 1 || loading} onClick={() => void load(page - 1)} aria-label="이전 게시글 페이지"><ChevronLeft size={17} /></button>
      {pages.map((item) => <button type="button" key={item} className={item === page ? "active" : ""} disabled={loading} onClick={() => void load(item)} aria-current={item === page ? "page" : undefined}>{item}</button>)}
      <button type="button" disabled={page === totalPages || loading} onClick={() => void load(page + 1)} aria-label="다음 게시글 페이지"><ChevronRight size={17} /></button>
    </nav>}
  </section>;
}
