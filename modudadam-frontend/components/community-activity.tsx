"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, FileText, LoaderCircle, MessageCircle, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { CategoryGrid } from "@/components/category-grid";
import { PostListMeta } from "@/components/post-list-meta";
import { displayPostTitle } from "@/lib/post-display";

type ActivityPost = { id: string; title: string; createdAt: string; viewCount: number; commentCount: number; categoryName: string; authorName: string; authorStampEmoji?: string | null };
type ActivityComment = { id: string; postId: string; content: string; createdAt: string; postTitle: string; categoryName: string };
type Tab = "posts" | "comments" | "scraps";
type Activity = {
  posts: ActivityPost[]; comments: ActivityComment[]; scraps: ActivityPost[];
  counts: Record<Tab, number>;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

export function CommunityActivity() {
  const [tab, setTab] = useState<Tab>("posts");
  const [category, setCategory] = useState("pets");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [activityCounts, setActivityCounts] = useState<Record<Tab, number>>({ posts: 0, comments: 0, scraps: 0 });
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ category, type: tab, page: String(page) });
    apiRequest<Activity>(`/api/users/me/activity?${params}`, { cache: "no-store", signal: controller.signal })
      .then((result) => { setActivity(result); setActivityCounts(result.counts); setError(""); })
      .catch((caught) => {
        if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message);
      });
    return () => controller.abort();
  }, [category, page, reloadKey, tab]);

  function selectCategory(nextCategory: string) {
    if (nextCategory === category) return;
    setCategory(nextCategory);
    setPage(1);
    setActivity(null);
    setActivityCounts({ posts: 0, comments: 0, scraps: 0 });
    setError("");
  }

  function selectTab(nextTab: Tab) {
    if (nextTab === tab) return;
    setTab(nextTab);
    setPage(1);
    setActivity(null);
    setError("");
  }

  function movePage(nextPage: number) {
    if (!activity || nextPage === page || nextPage < 1 || nextPage > activity.pagination.totalPages) return;
    setPage(nextPage);
    setActivity(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function refreshAfterMutation(itemCount: number) {
    setActivity(null);
    if (page > 1 && itemCount === 1) setPage((current) => current - 1);
    else setReloadKey((current) => current + 1);
  }

  async function deletePost(id: string) {
    if (!window.confirm("글을 삭제할까요?")) return;
    try {
      await apiRequest(`/api/posts/${id}`, { method: "DELETE" });
      refreshAfterMutation(activity?.posts.length || 0);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "글을 삭제하지 못했습니다."); }
  }

  async function deleteComment(id: string) {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    try {
      await apiRequest(`/api/comments/${id}`, { method: "DELETE" });
      refreshAfterMutation(activity?.comments.length || 0);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "댓글을 삭제하지 못했습니다."); }
  }

  async function removeScrap(id: string) {
    try {
      await apiRequest(`/api/posts/${id}/bookmark`, { method: "POST", body: JSON.stringify({ enabled: false }) });
      refreshAfterMutation(activity?.scraps.length || 0);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "스크랩을 해제하지 못했습니다."); }
  }

  const counts = activity?.counts || activityCounts;
  return <div className="activity-page-layout">
    <section className="activity-board-picker">
      <div className="activity-board-picker-heading"><strong>게시판 선택</strong><span>카테고리를 선택해 주세요.</span></div>
      <CategoryGrid selectedCode={category} onSelect={selectCategory} className="activity-board-grid" includeCommunityBoards/>
    </section>

    <section className="activity-card activity-page-card">
      <nav className="activity-tabs" aria-label="내 커뮤니티 활동">
        <button type="button" className={tab === "posts" ? "active" : ""} onClick={() => selectTab("posts")}><FileText size={16}/> 작성글 <b>{counts.posts}</b></button>
        <button type="button" className={tab === "comments" ? "active" : ""} onClick={() => selectTab("comments")}><MessageCircle size={16}/> 작성 댓글 <b>{counts.comments}</b></button>
        <button type="button" className={tab === "scraps" ? "active" : ""} onClick={() => selectTab("scraps")}><Bookmark size={16}/> 스크랩 <b>{counts.scraps}</b></button>
      </nav>
      {error && <div className="form-error">{error}</div>}
      {!activity && !error && <div className="activity-loading"><LoaderCircle className="spin" size={22}/> 활동을 불러오는 중입니다.</div>}
      {activity && <div className="activity-list">
        {tab === "posts" && <>{activity.posts.map((post) => <article key={post.id}><Link href={`/posts/${post.id}`}><small>{post.categoryName}</small><strong title={post.title}>{displayPostTitle(post.title)}</strong><PostListMeta className="activity-post-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/></Link><div><Link href={`/posts/${post.id}/edit`}>수정</Link><button type="button" onClick={() => void deletePost(post.id)}><Trash2 size={13}/> 삭제</button></div></article>)}{activity.posts.length === 0 && <EmptyActivity>이 게시판에 작성한 글이 없습니다.</EmptyActivity>}</>}
        {tab === "comments" && <>{activity.comments.map((comment) => <article key={comment.id}><Link href={`/posts/${comment.postId}`}><small>{comment.categoryName}</small><strong title={comment.postTitle}>{displayPostTitle(comment.postTitle)}</strong><p className="activity-comment-preview">{comment.content}</p><span>{formatDate(comment.createdAt)}</span></Link><div><button type="button" onClick={() => void deleteComment(comment.id)}><Trash2 size={13}/> 삭제</button></div></article>)}{activity.comments.length === 0 && <EmptyActivity>이 게시판에 작성한 댓글이 없습니다.</EmptyActivity>}</>}
        {tab === "scraps" && <>{activity.scraps.map((post) => <article key={post.id}><Link href={`/posts/${post.id}`}><small>{post.categoryName}</small><strong title={post.title}>{displayPostTitle(post.title)}</strong><PostListMeta className="activity-post-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/></Link><div><button type="button" onClick={() => void removeScrap(post.id)}><Bookmark size={13}/> 해제</button></div></article>)}{activity.scraps.length === 0 && <EmptyActivity>이 게시판에 스크랩한 글이 없습니다.</EmptyActivity>}</>}
      </div>}
      {activity && <nav className="activity-pagination" aria-label="내 활동 페이지">
        <button type="button" onClick={() => movePage(page - 1)} disabled={page <= 1} aria-label="이전 페이지"><ChevronLeft size={15}/></button>
        {pageNumbers(page, activity.pagination.totalPages).map((number) => <button key={number} type="button" className={number === page ? "active" : ""} aria-current={number === page ? "page" : undefined} onClick={() => movePage(number)}>{number}</button>)}
        <button type="button" onClick={() => movePage(page + 1)} disabled={page >= activity.pagination.totalPages} aria-label="다음 페이지"><ChevronRight size={15}/></button>
      </nav>}
    </section>
  </div>;
}

function EmptyActivity({ children }: { children: React.ReactNode }) { return <div className="activity-empty">{children}</div>; }
function pageNumbers(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index);
}
function formatDate(value: string) { return new Date(value).toLocaleDateString("ko-KR"); }
