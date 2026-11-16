"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, FileText, LoaderCircle, MessageCircle, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

type ActivityPost = { id: string; title: string; createdAt: string; viewCount: number; commentCount: number; categoryName: string; authorName?: string };
type ActivityComment = { id: string; postId: string; content: string; createdAt: string; postTitle: string; categoryName: string };
type Activity = { posts: ActivityPost[]; comments: ActivityComment[]; scraps: ActivityPost[] };
type Tab = "posts" | "comments" | "scraps";

export function CommunityActivity() {
  const [tab, setTab] = useState<Tab>("posts");
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest<Activity>("/api/users/me/activity", { cache: "no-store" })
      .then(setActivity)
      .catch((caught) => setError(caught instanceof Error ? caught.message : "내 활동을 불러오지 못했습니다."));
  }, []);

  async function deletePost(id: string) {
    if (!window.confirm("글을 삭제할까요?")) return;
    try {
      await apiRequest(`/api/posts/${id}`, { method: "DELETE" });
      setActivity((current) => current ? { ...current, posts: current.posts.filter((post) => post.id !== id) } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "글을 삭제하지 못했습니다.");
    }
  }

  async function deleteComment(id: string) {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    try {
      await apiRequest(`/api/comments/${id}`, { method: "DELETE" });
      setActivity((current) => current ? { ...current, comments: current.comments.filter((comment) => comment.id !== id) } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "댓글을 삭제하지 못했습니다.");
    }
  }

  async function removeScrap(id: string) {
    try {
      await apiRequest(`/api/posts/${id}/bookmark`, { method: "POST", body: JSON.stringify({ enabled: false }) });
      setActivity((current) => current ? { ...current, scraps: current.scraps.filter((post) => post.id !== id) } : current);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "스크랩을 해제하지 못했습니다.");
    }
  }

  return <section className="activity-card">
    <header><div><small>MY COMMUNITY</small><h2>내 커뮤니티 활동</h2></div></header>
    <nav className="activity-tabs" aria-label="내 커뮤니티 활동">
      <button type="button" className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")}><FileText size={16}/> 작성글 <b>{activity?.posts.length || 0}</b></button>
      <button type="button" className={tab === "comments" ? "active" : ""} onClick={() => setTab("comments")}><MessageCircle size={16}/> 작성 댓글 <b>{activity?.comments.length || 0}</b></button>
      <button type="button" className={tab === "scraps" ? "active" : ""} onClick={() => setTab("scraps")}><Bookmark size={16}/> 스크랩 <b>{activity?.scraps.length || 0}</b></button>
    </nav>
    {error && <div className="form-error">{error}</div>}
    {!activity && !error && <div className="activity-loading"><LoaderCircle className="spin" size={22}/> 활동을 불러오는 중입니다.</div>}
    {activity && <div className="activity-list">
      {tab === "posts" && <>{activity.posts.map((post) => <article key={post.id}><Link href={`/posts/${post.id}`}><small>{post.categoryName}</small><strong>{post.title}</strong><span>{new Date(post.createdAt).toLocaleDateString("ko-KR")} · 조회 {post.viewCount} · 댓글 {post.commentCount}</span></Link><div><Link href={`/posts/${post.id}/edit`}>수정</Link><button type="button" onClick={() => void deletePost(post.id)}><Trash2 size={13}/> 삭제</button></div></article>)}{activity.posts.length === 0 && <EmptyActivity>작성한 글이 없습니다.</EmptyActivity>}</>}
      {tab === "comments" && <>{activity.comments.map((comment) => <article key={comment.id}><Link href={`/posts/${comment.postId}`}><small>{comment.categoryName} · {comment.postTitle}</small><strong>{comment.content}</strong><span>{new Date(comment.createdAt).toLocaleDateString("ko-KR")}</span></Link><div><button type="button" onClick={() => void deleteComment(comment.id)}><Trash2 size={13}/> 삭제</button></div></article>)}{activity.comments.length === 0 && <EmptyActivity>작성한 댓글이 없습니다.</EmptyActivity>}</>}
      {tab === "scraps" && <>{activity.scraps.map((post) => <article key={post.id}><Link href={`/posts/${post.id}`}><small>{post.categoryName} · {post.authorName}</small><strong>{post.title}</strong><span>{new Date(post.createdAt).toLocaleDateString("ko-KR")} · 댓글 {post.commentCount}</span></Link><div><button type="button" onClick={() => void removeScrap(post.id)}><Bookmark size={13}/> 해제</button></div></article>)}{activity.scraps.length === 0 && <EmptyActivity>스크랩한 글이 없습니다.</EmptyActivity>}</>}
    </div>}
  </section>;
}

function EmptyActivity({ children }: { children: React.ReactNode }) {
  return <div className="activity-empty">{children}</div>;
}
