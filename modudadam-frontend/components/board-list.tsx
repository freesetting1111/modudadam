"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, MessageCircle, PenLine } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Sort = "latest" | "popular";
export type BoardPost = {
  id: string; title: string; excerpt: string; authorName: string; viewCount: number;
  commentCount: number; createdAt: string; isNotice: boolean; isPinned: boolean;
};
export type BoardFeedPage = { posts: BoardPost[]; nextCursor: string | null };

const PAGE_SIZE = 20;

export function BoardList({ categoryCode, categoryName, authenticated, initialPage }: { categoryCode: string; categoryName: string; authenticated: boolean; initialPage?: BoardFeedPage }) {
  const [sort, setSort] = useState<Sort>("latest");
  const [pages, setPages] = useState<BoardFeedPage[]>(initialPage ? [initialPage] : []);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(!initialPage);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<BoardFeedPage>(feedUrl(categoryCode, sort))
      .then((data) => { if (active) { setPages([data]); setError(""); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryCode, sort]);

  const page = pages[pageIndex];
  const posts = page?.posts || [];
  const canMoveNext = Boolean(page?.nextCursor || pages[pageIndex + 1]);

  function changeSort(nextSort: Sort) {
    if (nextSort === sort) return;
    setLoading(true);
    setPages([]);
    setPageIndex(0);
    setError("");
    setSort(nextSort);
  }

  async function moveToPage(nextIndex: number) {
    if (nextIndex < 0 || nextIndex === pageIndex || loading) return;
    if (pages[nextIndex]) {
      setPageIndex(nextIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (nextIndex !== pageIndex + 1 || !page?.nextCursor) return;
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<BoardFeedPage>(feedUrl(categoryCode, sort, page.nextCursor));
      setPages((current) => [...current, data]);
      setPageIndex(nextIndex);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "다음 페이지를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const visiblePageCount = pages.length + (pages.at(-1)?.nextCursor ? 1 : 0);

  return <>
    <div className="board-toolbar board-toolbar-compact">
      <div className="board-sort-control">
        <label htmlFor="board-sort">정렬</label>
        <select id="board-sort" value={sort} onChange={(event) => changeSort(event.target.value as Sort)}>
          <option value="latest">최신순</option>
          <option value="popular">인기순</option>
        </select>
        <small>{sort === "popular" ? "조회와 댓글 반영" : "최근 등록 순서"}</small>
      </div>
      {authenticated && <Link className="write-button" href={`/category/${categoryCode}/write`}><PenLine size={14} /> 글쓰기</Link>}
    </div>
    {loading && posts.length === 0 && <div className="board-message">게시글을 불러오고 있어요.</div>}
    {error && <div className="board-message error">{error}</div>}
    {!loading && !error && posts.length === 0 && <div className="empty-card"><strong>첫 이야기를 기다리고 있어요</strong><p>{categoryName}에 관한 경험과 정보를 나눠보세요.</p>{authenticated && <Link href={`/category/${categoryCode}/write`}>첫 글 작성하기</Link>}</div>}
    {posts.length > 0 && <>
      <div className="board-list" aria-busy={loading}>{posts.map((post) =>
        <Link href={`/posts/${post.id}`} className="board-row board-row-dense" key={post.id}>
          <div className="board-row-main">
            <div className="board-row-title">{(post.isNotice || post.isPinned) && <b className="notice-badge">공지</b>}{post.title}</div>
            {post.excerpt && <p>{post.excerpt}</p>}
          </div>
          <div className="board-row-meta">
            <span className="board-author">{post.authorName}</span>
            <time dateTime={post.createdAt}>{formatBoardDate(post.createdAt)}</time>
            <span aria-label={`조회 ${post.viewCount}`}><Eye size={13} /> {post.viewCount}</span>
            <span aria-label={`댓글 ${post.commentCount}`}><MessageCircle size={13} /> {post.commentCount}</span>
          </div>
        </Link>)}</div>
      <nav className="board-pagination" aria-label="게시글 페이지">
        <button type="button" aria-label="이전 페이지" disabled={pageIndex === 0 || loading} onClick={() => void moveToPage(pageIndex - 1)}><ChevronLeft size={17} /></button>
        {Array.from({ length: visiblePageCount }, (_, index) => <button type="button" key={index} className={index === pageIndex ? "active" : ""} aria-current={index === pageIndex ? "page" : undefined} disabled={loading || (!pages[index] && index !== pageIndex + 1)} onClick={() => void moveToPage(index)}>{index + 1}</button>)}
        <button type="button" aria-label="다음 페이지" disabled={!canMoveNext || loading} onClick={() => void moveToPage(pageIndex + 1)}><ChevronRight size={17} /></button>
      </nav>
    </>}
  </>;
}

function feedUrl(categoryCode: string, sort: Sort, cursor?: string) {
  const params = new URLSearchParams({ category: categoryCode, sort, limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  return `/api/posts?${params}`;
}

function formatBoardDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  return date.toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }).replace(/\s/g, "");
}
