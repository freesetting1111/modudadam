"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MessageCircle, Pencil, Reply, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Post = {
  id: string; title: string; summary: string | null; content: string; authorName: string;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number;
  createdAt: string; updatedAt: string; canEdit: boolean;
};
type Comment = {
  id: string; parentId: string | null; status: "published" | "deleted"; content: string;
  authorName: string; createdAt: string; updatedAt: string; canDelete: boolean;
};

export function PostDetail({ postId, authenticated }: { postId: string; authenticated: boolean }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const loadComments = useCallback(() => apiRequest<{ comments: Comment[] }>(`/api/posts/${postId}/comments`).then((data) => setComments(data.comments)), [postId]);
  const loadPost = useCallback(() => apiRequest<{ post: Post }>(`/api/posts/${postId}`).then((data) => setPost(data.post)), [postId]);

  useEffect(() => {
    loadPost().catch((caught) => setError(caught instanceof Error ? caught.message : "글을 불러오지 못했습니다."));
    loadComments().catch(() => setCommentError("댓글을 불러오지 못했습니다."));
  }, [loadComments, loadPost]);

  const commentGroups = useMemo(() => comments.filter((comment) => !comment.parentId).map((comment) => ({
    comment,
    replies: comments.filter((reply) => reply.parentId === comment.id),
  })), [comments]);
  const activeCommentCount = comments.filter((comment) => comment.status === "published").length;

  async function submitComment(event: FormEvent<HTMLFormElement>, parentId?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setCommentError("");
    try {
      await apiRequest(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: data.get("content"), parentId: parentId || null }),
      });
      form.reset();
      setReplyingTo(null);
      await loadComments();
    } catch (caught) {
      setCommentError(caught instanceof Error ? caught.message : "댓글을 저장하지 못했습니다.");
    }
  }

  async function deletePost() {
    if (!post || !window.confirm("게시글을 삭제할까요? 삭제한 글은 목록에서 보이지 않습니다.")) return;
    setDeletingPost(true);
    try {
      await apiRequest(`/api/posts/${post.id}`, { method: "DELETE" });
      router.replace(`/category/${post.categoryCode}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "게시글을 삭제하지 못했습니다.");
      setDeletingPost(false);
    }
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    try {
      await apiRequest(`/api/comments/${commentId}`, { method: "DELETE" });
      await loadComments();
    } catch (caught) {
      setCommentError(caught instanceof Error ? caught.message : "댓글을 삭제하지 못했습니다.");
    }
  }

  if (error) return <section className="content-page"><div className="board-message error">{error}</div></section>;
  if (!post) return <section className="content-page"><div className="board-message">글을 불러오고 있어요.</div></section>;

  return <article className="content-page post-page">
    <Link className="back-link" href={`/category/${post.categoryCode}`}>‹ {post.categoryName} 게시판</Link>
    <header className="post-header">
      <h1>{post.title}</h1>
      {post.summary && <p>{post.summary}</p>}
      <div className="post-meta"><small>{post.authorName} · {new Date(post.createdAt).toLocaleString("ko-KR")} · 조회 {post.viewCount}</small>
        {post.canEdit && <div className="post-owner-actions"><Link href={`/posts/${post.id}/edit`}><Pencil size={14} /> 수정</Link><button type="button" onClick={deletePost} disabled={deletingPost}><Trash2 size={14} /> {deletingPost ? "삭제 중" : "삭제"}</button></div>}
      </div>
    </header>
    <div className="post-content">{post.content}</div>
    <section className="comments-section">
      <h2><MessageCircle size={18} /> 댓글 {activeCommentCount}</h2>
      {authenticated ? <form className="comment-form" onSubmit={(event) => submitComment(event)}><textarea name="content" required maxLength={3000} rows={3} placeholder="댓글을 입력해 주세요."/><button type="submit">댓글 등록</button></form>
        : <Link className="comment-login-prompt" href={`/login?returnTo=${encodeURIComponent(`/posts/${postId}`)}`}>댓글을 작성하려면 로그인해 주세요.</Link>}
      {commentError && <div className="form-error comment-error">{commentError}</div>}
      <div className="comment-list">{commentGroups.length === 0 ? <p className="no-comments">첫 댓글을 남겨보세요.</p> : commentGroups.map(({ comment, replies }) => <div className="comment-thread" key={comment.id}>
        <CommentItem comment={comment} authenticated={authenticated} onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} onDelete={deleteComment} />
        {replyingTo === comment.id && <form className="comment-form reply-form" onSubmit={(event) => submitComment(event, comment.id)}><textarea name="content" required maxLength={3000} rows={2} autoFocus placeholder={`${comment.authorName}님에게 답글 작성`} /><div><button type="button" className="reply-cancel" onClick={() => setReplyingTo(null)}>취소</button><button type="submit">답글 등록</button></div></form>}
        {replies.length > 0 && <div className="reply-list">{replies.map((reply) => <CommentItem key={reply.id} comment={reply} authenticated={authenticated} reply onDelete={deleteComment} />)}</div>}
      </div>)}</div>
    </section>
  </article>;
}

function CommentItem({ comment, authenticated, reply = false, onReply, onDelete }: { comment: Comment; authenticated: boolean; reply?: boolean; onReply?: () => void; onDelete: (commentId: string) => void }) {
  return <div className={`comment ${reply ? "reply" : ""} ${comment.status === "deleted" ? "deleted" : ""}`}>
    <div className="comment-head"><b>{comment.authorName}</b><small>{new Date(comment.createdAt).toLocaleString("ko-KR")}</small></div>
    <p>{comment.content}</p>
    {comment.status === "published" && <div className="comment-actions">
      {authenticated && onReply && <button type="button" onClick={onReply}><Reply size={13} /> 답글</button>}
      {comment.canDelete && <button type="button" className="comment-delete" onClick={() => onDelete(comment.id)}><Trash2 size={13} /> 삭제</button>}
    </div>}
  </div>;
}
