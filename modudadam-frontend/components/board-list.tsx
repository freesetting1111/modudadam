"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { PostListMeta } from "@/components/post-list-meta";
import { displayPostTitle } from "@/lib/post-display";

export type BoardPost = {
  id: string; title: string; excerpt: string; authorName: string; authorStampEmoji: string | null; viewCount: number;
  commentCount: number; createdAt: string; isNotice: boolean; isPinned: boolean;
  isRead: boolean;
};
export type BoardFeedPage = { posts: BoardPost[]; nextCursor: string | null };

const PAGE_SIZE = 20;

export function BoardList({ categoryCode, categoryName, canWrite, initialPage }: { categoryCode: string; categoryName: string; canWrite: boolean; initialPage?: BoardFeedPage }) {
  const [pages, setPages] = useState<BoardFeedPage[]>(initialPage ? [initialPage] : []);
  const [pageIndex, setPageIndex] = useState(0);
  const [loading, setLoading] = useState(!initialPage);
  const [error, setError] = useState("");
  const initialPageCategory = useRef(initialPage ? categoryCode : "");

  useEffect(() => {
    if (initialPageCategory.current === categoryCode) return;
    let active = true;
    apiRequest<BoardFeedPage>(feedUrl(categoryCode))
      .then((data) => { if (active) { setPages([data]); setError(""); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryCode]);

  const page = pages[pageIndex];
  const posts = page?.posts || [];
  const canMoveNext = Boolean(page?.nextCursor || pages[pageIndex + 1]);

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
      const data = await apiRequest<BoardFeedPage>(feedUrl(categoryCode, page.nextCursor));
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
    {canWrite && <div className="board-toolbar board-toolbar-compact board-toolbar-write-only"><Link className="write-button" href={`/category/${categoryCode}/write`}><PenLine size={14} /> 글쓰기</Link></div>}
    {loading && posts.length === 0 && <div className="board-message">게시글을 불러오고 있어요.</div>}
    {error && <div className="board-message error">{error}</div>}
    {!loading && !error && posts.length === 0 && <div className="empty-card"><strong>등록된 게시글이 없습니다</strong><p>{categoryName} 게시판에 첫 게시글을 작성해 보세요.</p>{canWrite && <Link href={`/category/${categoryCode}/write`}>게시글 작성</Link>}</div>}
    {posts.length > 0 && <>
      <div className="board-list" aria-busy={loading}>{posts.map((post) =>
        <Link href={`/posts/${post.id}`} className={`board-row board-row-dense ${post.isRead ? "is-read" : ""}`} key={post.id}>
          <div className="board-row-main">
            <div className="board-row-title" title={post.title}>{(post.isNotice || post.isPinned) && <b className="notice-badge">공지</b>}{displayPostTitle(post.title)}</div>
          </div>
          <PostListMeta className="board-row-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/>
        </Link>)}</div>
      <nav className="board-pagination" aria-label="게시글 페이지">
        <button type="button" aria-label="이전 페이지" disabled={pageIndex === 0 || loading} onClick={() => void moveToPage(pageIndex - 1)}><ChevronLeft size={17} /></button>
        {Array.from({ length: visiblePageCount }, (_, index) => <button type="button" key={index} className={index === pageIndex ? "active" : ""} aria-current={index === pageIndex ? "page" : undefined} disabled={loading || (!pages[index] && index !== pageIndex + 1)} onClick={() => void moveToPage(index)}>{index + 1}</button>)}
        <button type="button" aria-label="다음 페이지" disabled={!canMoveNext || loading} onClick={() => void moveToPage(pageIndex + 1)}><ChevronRight size={17} /></button>
      </nav>
    </>}
  </>;
}
function feedUrl(categoryCode: string, cursor?: string) {
  const params = new URLSearchParams({ category: categoryCode, sort: "latest", limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);
  return `/api/posts?${params}`;
}
