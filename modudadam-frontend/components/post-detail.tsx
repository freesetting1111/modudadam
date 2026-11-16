"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Flag, MessageCircle, Pencil, Reply, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";

type Post = {
  id: string; title: string; content: string; authorName: string;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number;
  createdAt: string; updatedAt: string; canEdit: boolean; canReport: boolean;
  isBookmarked: boolean; bookmarkCount: number;
  images: { id: string; url: string; originalName: string; mimeType: string; byteSize: number }[];
};
type Comment = {
  id: string; parentId: string | null; status: "published" | "deleted"; content: string;
  authorName: string; createdAt: string; updatedAt: string; canDelete: boolean; canEdit: boolean; canReport: boolean;
};

const REPORT_REASONS = ["스팸·홍보/도배", "욕설·비방·혐오 표현", "음란물·부적절한 콘텐츠", "개인정보 노출", "허위사실·사기", "게시판 성격에 맞지 않음", "기타"];

export function PostDetail({ postId, authenticated }: { postId: string; authenticated: boolean }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

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

  async function editComment(commentId: string, content: string) {
    await apiRequest(`/api/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ content }) });
    await loadComments();
  }

  async function toggleBookmark() {
    if (!post || bookmarkPending) return;
    if (!authenticated) {
      router.push(`/login?returnTo=${encodeURIComponent(`/posts/${postId}`)}`);
      return;
    }
    setBookmarkPending(true);
    try {
      const result = await apiRequest<{ bookmarked: boolean; bookmarkCount: number }>(`/api/posts/${post.id}/bookmark`, {
        method: "POST",
        body: JSON.stringify({ enabled: !post.isBookmarked }),
      });
      setPost({ ...post, isBookmarked: result.bookmarked, bookmarkCount: result.bookmarkCount });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "스크랩 상태를 변경하지 못했습니다.");
    } finally {
      setBookmarkPending(false);
    }
  }

  function openReport(type: "post" | "comment", id: string) {
    setReportTarget({ type, id });
    setReportReason("");
    setReportDetail("");
    setReportError("");
  }

  async function submitReport() {
    if (!reportTarget || !reportReason || (reportReason === "기타" && !reportDetail.trim())) return;
    setReportSubmitting(true);
    setReportError("");
    try {
      const path = reportTarget.type === "post" ? `/api/posts/${reportTarget.id}/report` : `/api/comments/${reportTarget.id}/report`;
      await apiRequest(path, { method: "POST", body: JSON.stringify({ reasonCode: reportReason, reasonDetail: reportDetail }) });
      setReportTarget(null);
      window.alert("신고가 접수되었습니다. 운영팀이 확인할게요.");
    } catch (caught) {
      setReportError(caught instanceof Error ? caught.message : "신고를 접수하지 못했습니다.");
    } finally {
      setReportSubmitting(false);
    }
  }

  if (error) return <section className="content-page"><div className="board-message error">{error}</div></section>;
  if (!post) return <section className="content-page"><div className="board-message">글을 불러오고 있어요.</div></section>;

  return <article className="content-page post-page">
    <Link className="back-link" href={`/category/${post.categoryCode}`}>‹ {post.categoryName} 게시판</Link>
    <header className="post-header">
      <h1>{post.title}</h1>
      <div className="post-meta"><small>{post.authorName} · {new Date(post.createdAt).toLocaleString("ko-KR")} · 조회 {post.viewCount}</small>
        {post.canEdit && <div className="post-owner-actions"><Link href={`/posts/${post.id}/edit`}><Pencil size={14} /> 수정</Link><button type="button" onClick={deletePost} disabled={deletingPost}><Trash2 size={14} /> {deletingPost ? "삭제 중" : "삭제"}</button></div>}
      </div>
    </header>
    <div className="post-content">{post.content}</div>
    {post.images.length > 0 && <div className="post-image-gallery">{post.images.map((image) => <figure key={image.id}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={image.originalName} loading="lazy" />
    </figure>)}</div>}
    <div className="post-community-actions">
      <button type="button" className={post.isBookmarked ? "active" : ""} onClick={toggleBookmark} disabled={bookmarkPending}><Bookmark size={17} fill={post.isBookmarked ? "currentColor" : "none"} /> {post.isBookmarked ? "스크랩됨" : "스크랩"}<small>{post.bookmarkCount}</small></button>
      {post.canReport && <button type="button" onClick={() => openReport("post", post.id)}><Flag size={17} /> 신고</button>}
    </div>
    <section className="comments-section">
      <h2><MessageCircle size={18} /> 댓글 {activeCommentCount}</h2>
      {authenticated ? <form className="comment-form" onSubmit={(event) => submitComment(event)}><textarea name="content" required maxLength={3000} rows={3} placeholder="댓글을 입력해 주세요."/><button type="submit">댓글 등록</button></form>
        : <Link className="comment-login-prompt" href={`/login?returnTo=${encodeURIComponent(`/posts/${postId}`)}`}>댓글을 작성하려면 로그인해 주세요.</Link>}
      {commentError && <div className="form-error comment-error">{commentError}</div>}
      <div className="comment-list">{commentGroups.length === 0 ? <p className="no-comments">첫 댓글을 남겨보세요.</p> : commentGroups.map(({ comment, replies }) => <div className="comment-thread" key={comment.id}>
        <CommentItem comment={comment} authenticated={authenticated} onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} onDelete={deleteComment} onEdit={editComment} onReport={(id) => openReport("comment", id)} />
        {replyingTo === comment.id && <form className="comment-form reply-form" onSubmit={(event) => submitComment(event, comment.id)}><textarea name="content" required maxLength={3000} rows={2} autoFocus placeholder={`${comment.authorName}님에게 답글 작성`} /><div><button type="button" className="reply-cancel" onClick={() => setReplyingTo(null)}>취소</button><button type="submit">답글 등록</button></div></form>}
        {replies.length > 0 && <div className="reply-list">{replies.map((reply) => <CommentItem key={reply.id} comment={reply} authenticated={authenticated} reply onDelete={deleteComment} onEdit={editComment} onReport={(id) => openReport("comment", id)} />)}</div>}
      </div>)}</div>
    </section>
    {reportTarget && <div className="report-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportTarget(null); }}>
      <section className="report-sheet">
        <header><div><h2 id="report-title">{reportTarget.type === "post" ? "이 글 신고하기" : "댓글 신고하기"}</h2><p>신고 사유를 선택해 주세요. 운영팀이 검토합니다.</p></div><button type="button" onClick={() => setReportTarget(null)} aria-label="신고 창 닫기">×</button></header>
        <div className="report-reasons">{REPORT_REASONS.map((reason) => <label key={reason}><input type="radio" name="report-reason" value={reason} checked={reportReason === reason} onChange={() => { setReportReason(reason); setReportError(""); }} /> {reason}</label>)}</div>
        {reportReason === "기타" && <label className="report-detail"><span>상세 사유</span><textarea value={reportDetail} onChange={(event) => setReportDetail(event.target.value.slice(0, 1000))} rows={4} maxLength={1000} placeholder="신고 사유를 입력해 주세요."/><small>{reportDetail.length}/1,000</small></label>}
        {reportError && <div className="form-error">{reportError}</div>}
        <div className="report-buttons"><button type="button" onClick={() => setReportTarget(null)}>취소</button><button type="button" onClick={submitReport} disabled={reportSubmitting || !reportReason || (reportReason === "기타" && !reportDetail.trim())}>{reportSubmitting ? "제출 중" : "신고 제출"}</button></div>
      </section>
    </div>}
  </article>;
}

function CommentItem({ comment, authenticated, reply = false, onReply, onDelete, onEdit, onReport }: { comment: Comment; authenticated: boolean; reply?: boolean; onReply?: () => void; onDelete: (commentId: string) => void; onEdit: (commentId: string, content: string) => Promise<void>; onReport: (commentId: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState("");
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editContent.trim()) return;
    setEditPending(true);
    setEditError("");
    try {
      await onEdit(comment.id, editContent.trim());
      setEditing(false);
    } catch (caught) {
      setEditError(caught instanceof Error ? caught.message : "댓글을 수정하지 못했습니다.");
    } finally {
      setEditPending(false);
    }
  }
  return <div className={`comment ${reply ? "reply" : ""} ${comment.status === "deleted" ? "deleted" : ""}`}>
    <div className="comment-head"><b>{comment.authorName}</b><small>{new Date(comment.createdAt).toLocaleString("ko-KR")}</small></div>
    {editing ? <form className="comment-edit-form" onSubmit={submitEdit}><textarea value={editContent} onChange={(event) => setEditContent(event.target.value.slice(0, 3000))} rows={3} maxLength={3000}/>{editError && <small className="profile-error">{editError}</small>}<div><button type="button" onClick={() => { setEditing(false); setEditContent(comment.content); setEditError(""); }}>취소</button><button type="submit" disabled={editPending || !editContent.trim()}>{editPending ? "저장 중" : "저장"}</button></div></form> : <p>{comment.content}</p>}
    {comment.status === "published" && <div className="comment-actions">
      {authenticated && onReply && <button type="button" onClick={onReply}><Reply size={13} /> 답글</button>}
      {comment.canEdit && <button type="button" onClick={() => setEditing(true)}><Pencil size={13} /> 수정</button>}
      {comment.canDelete && <button type="button" className="comment-delete" onClick={() => onDelete(comment.id)}><Trash2 size={13} /> 삭제</button>}
      {comment.canReport && <button type="button" onClick={() => onReport(comment.id)}><Flag size={13} /> 신고</button>}
    </div>}
  </div>;
}
