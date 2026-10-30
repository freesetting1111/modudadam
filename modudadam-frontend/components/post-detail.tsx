"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";

type Post = { id:string; title:string; summary:string|null; content:string; authorName:string; categoryCode:string; categoryName:string; viewCount:number; commentCount:number; createdAt:string };
type Comment = { id:string; content:string; authorName:string; createdAt:string };

export function PostDetail({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");

  const loadComments = useCallback(() => apiRequest<{comments:Comment[]}>(`/api/posts/${postId}/comments`).then((data) => setComments(data.comments)), [postId]);
  useEffect(() => {
    apiRequest<{post:Post}>(`/api/posts/${postId}`).then((data) => setPost(data.post)).catch((caught) => setError(caught instanceof Error ? caught.message : "글을 불러오지 못했습니다."));
    void loadComments();
  }, [postId, loadComments]);

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setCommentError("");
    try {
      await apiRequest(`/api/posts/${postId}/comments`, { method:"POST", body:JSON.stringify({content:data.get("content")}) });
      form.reset();
      await loadComments();
    } catch (caught) {
      setCommentError(caught instanceof ApiError && caught.status === 401 ? "댓글을 작성하려면 로그인이 필요합니다." : caught instanceof Error ? caught.message : "댓글을 저장하지 못했습니다.");
    }
  }

  if (error) return <section className="content-page"><div className="board-message error">{error}</div></section>;
  if (!post) return <section className="content-page"><div className="board-message">글을 불러오고 있어요.</div></section>;
  return <article className="content-page post-page">
    <Link className="back-link" href={`/category/${post.categoryCode}`}>‹ {post.categoryName} 게시판</Link>
    <header className="post-header"><h1>{post.title}</h1>{post.summary && <p>{post.summary}</p>}<small>{post.authorName} · {new Date(post.createdAt).toLocaleString("ko-KR")} · 조회 {post.viewCount}</small></header>
    <div className="post-content">{post.content}</div>
    <section className="comments-section"><h2>댓글 {comments.length}</h2>
      <form className="comment-form" onSubmit={submitComment}><textarea name="content" required maxLength={3000} rows={3} placeholder="댓글을 입력해 주세요."/><button type="submit">댓글 등록</button></form>
      {commentError && <div className="form-error">{commentError} <Link href={`/login?returnTo=/posts/${postId}`}>로그인</Link></div>}
      <div className="comment-list">{comments.length === 0 ? <p className="no-comments">첫 댓글을 남겨보세요.</p> : comments.map((comment) => <div className="comment" key={comment.id}><b>{comment.authorName}</b><p>{comment.content}</p><small>{new Date(comment.createdAt).toLocaleString("ko-KR")}</small></div>)}</div>
    </section>
  </article>;
}
