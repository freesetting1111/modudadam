"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Flag, HandCoins, Heart, MessageCircle, Pencil, Reply, Share2, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { DetailBoardList } from "@/components/detail-board-list";
import type { PublicPost as Post } from "@/lib/public-post";
import { StampedName } from "@/components/stamped-name";

type Comment = {
  id: string; parentId: string | null; replyToId: string | null; replyToAuthor: string | null; replyToStampEmoji: string | null;
  status: "published" | "deleted"; content: string; authorName: string; authorStampEmoji: string | null;
  createdAt: string; updatedAt: string; canDelete: boolean; canEdit: boolean; canReport: boolean;
  likeCount: number; dislikeCount: number; myReaction: "like" | "dislike" | null;
  isBountyWinner:boolean;canReceiveBounty:boolean;
  helpScore:number;acceptedAnswers:number;
};
type Pagination = { page: number; pageSize: number; totalItems: number; totalPages: number; commentCount: number };
type KakaoWindow = Window & { Kakao?: { isInitialized: () => boolean; init: (key: string) => void; Share: { sendDefault: (settings: Record<string, unknown>) => void } } };

const REPORT_REASONS = ["스팸·홍보/도배", "욕설·비방·혐오 표현", "음란물·부적절한 콘텐츠", "개인정보 노출", "허위사실·사기", "게시판 성격에 맞지 않음", "기타"];
const COMMENT_PAGE_SIZE = 20;
const REPLY_PAGE_SIZE = 5;

export function PostDetail({ postId, authenticated, kakaoJavascriptKey, initialPost }: { postId: string; authenticated: boolean; kakaoJavascriptKey: string; initialPost: Post }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(initialPost);
  const [comments, setComments] = useState<Comment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: COMMENT_PAGE_SIZE, totalItems: 0, totalPages: 1, commentCount: 0 });
  const [error, setError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, number>>({});
  const [deletingPost, setDeletingPost] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [bookmarkPending, setBookmarkPending] = useState(false);
  const [reactionPending, setReactionPending] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: "post" | "comment"; id: string } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetail, setReportDetail] = useState("");
  const [reportError, setReportError] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [bountyPending,setBountyPending]=useState(false);
  const requestedPostId = useRef<string | null>(null);

  const loadComments = useCallback(async (page = 1) => {
    const data = await apiRequest<{ comments: Comment[]; pagination: Pagination }>(`/api/posts/${postId}/comments?page=${page}&pageSize=${COMMENT_PAGE_SIZE}`);
    setComments(data.comments); setPagination(data.pagination); setExpandedReplies({});
  }, [postId]);
  useEffect(() => {
    if (requestedPostId.current === postId) return;
    requestedPostId.current = postId;
    // The post is already rendered by the server. This one request records the unique view;
    // its response must not replace the visible post and cause a second paint.
    void apiRequest<{ post: Post }>(`/api/posts/${postId}`).catch(() => undefined);
    void apiRequest<{ comments: Comment[]; pagination: Pagination }>(`/api/posts/${postId}/comments?page=1&pageSize=${COMMENT_PAGE_SIZE}`).then((commentData) => {
      if (requestedPostId.current !== postId) return;
      setComments(commentData.comments);
      setPagination(commentData.pagination);
    }).catch((caught) => { if (requestedPostId.current === postId) setError(caught instanceof Error ? caught.message : "글을 불러오지 못했습니다."); });
  }, [postId]);
  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (kakaoJavascriptKey) void loadKakaoSdk(kakaoJavascriptKey).catch(() => undefined);
  }, [kakaoJavascriptKey]);

  const commentGroups = useMemo(() => comments.filter((comment) => !comment.parentId).map((comment) => ({
    comment, replies: comments.filter((reply) => reply.parentId === comment.id),
  })), [comments]);
  function requireLogin() { router.push(`/login?returnTo=${encodeURIComponent(`/posts/${postId}`)}`); }

  async function submitComment(event: FormEvent<HTMLFormElement>, parentId?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setCommentError("");
    try {
      await apiRequest(`/api/posts/${postId}/comments`, { method: "POST", body: JSON.stringify({ content: data.get("content"), parentId: parentId || null }) });
      form.reset(); setReplyingTo(null);
      await loadComments(parentId ? pagination.page : 1);
    } catch (caught) { setCommentError(caught instanceof Error ? caught.message : "댓글을 저장하지 못했습니다."); }
  }
  async function deletePost() {
    if (!post || !window.confirm("게시글을 삭제할까요? 삭제한 글은 목록에서 보이지 않습니다.")) return;
    setDeletingPost(true);
    try { await apiRequest(`/api/posts/${post.id}`, { method: "DELETE" }); router.replace(`/category/${post.categoryCode}`); router.refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "게시글을 삭제하지 못했습니다."); setDeletingPost(false); }
  }
  async function deleteComment(commentId: string) {
    if (!window.confirm("댓글을 삭제할까요?")) return;
    try { await apiRequest(`/api/comments/${commentId}`, { method: "DELETE" }); await loadComments(pagination.page); }
    catch (caught) { setCommentError(caught instanceof Error ? caught.message : "댓글을 삭제하지 못했습니다."); }
  }
  async function editComment(commentId: string, content: string) {
    await apiRequest(`/api/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ content }) });
    await loadComments(pagination.page);
  }
  async function toggleLike() {
    if (!post || likePending) return;
    if (!authenticated) return requireLogin();
    const previous = post;
    const enabled = !post.isLiked;
    setPost({ ...post, isLiked: enabled, likeCount: Math.max(0, post.likeCount + (enabled ? 1 : -1)) });
    setLikePending(true);
    try {
      const result = await apiRequest<{ liked: boolean; likeCount: number }>(`/api/posts/${post.id}/like`, { method: "POST", body: JSON.stringify({ enabled }) });
      setPost((current) => current ? { ...current, isLiked: result.liked, likeCount: result.likeCount } : current);
    } catch (caught) { setPost(previous); setError(caught instanceof Error ? caught.message : "좋아요 상태를 변경하지 못했습니다."); }
    finally { setLikePending(false); }
  }
  async function toggleBookmark() {
    if (!post || bookmarkPending) return;
    if (!authenticated) return requireLogin();
    const previous = post;
    const enabled = !post.isBookmarked;
    setPost({ ...post, isBookmarked: enabled, bookmarkCount: Math.max(0, post.bookmarkCount + (enabled ? 1 : -1)) });
    setBookmarkPending(true);
    try {
      const result = await apiRequest<{ bookmarked: boolean; bookmarkCount: number }>(`/api/posts/${post.id}/bookmark`, { method: "POST", body: JSON.stringify({ enabled }) });
      setPost((current) => current ? { ...current, isBookmarked: result.bookmarked, bookmarkCount: result.bookmarkCount } : current);
    } catch (caught) { setPost(previous); setError(caught instanceof Error ? caught.message : "스크랩 상태를 변경하지 못했습니다."); }
    finally { setBookmarkPending(false); }
  }
  async function reactToComment(commentId: string, reaction: "like" | "dislike") {
    if (!authenticated) return requireLogin();
    if (reactionPending.has(commentId)) return;
    const previous = comments.find((comment) => comment.id === commentId);
    if (!previous) return;
    const nextReaction = previous.myReaction === reaction ? null : reaction;
    setReactionPending((current) => new Set(current).add(commentId));
    setComments((current) => current.map((comment) => comment.id === commentId ? {
      ...comment,
      likeCount: Math.max(0, comment.likeCount - (comment.myReaction === "like" ? 1 : 0) + (nextReaction === "like" ? 1 : 0)),
      dislikeCount: Math.max(0, comment.dislikeCount - (comment.myReaction === "dislike" ? 1 : 0) + (nextReaction === "dislike" ? 1 : 0)),
      myReaction: nextReaction,
    } : comment));
    try {
      const result = await apiRequest<{ likeCount: number; dislikeCount: number; myReaction: "like" | "dislike" | null }>(`/api/comments/${commentId}/reaction`, { method: "POST", body: JSON.stringify({ reaction }) });
      setComments((current) => current.map((comment) => comment.id === commentId ? { ...comment, ...result } : comment));
    } catch (caught) {
      setComments((current) => current.map((comment) => comment.id === commentId ? previous : comment));
      setCommentError(caught instanceof Error ? caught.message : "댓글 평가를 반영하지 못했습니다.");
    } finally {
      setReactionPending((current) => { const next = new Set(current); next.delete(commentId); return next; });
    }
  }
  async function awardBounty(commentId:string) {
    if (!post?.bounty || bountyPending) return;
    if (!window.confirm(`이 답변을 채택하고 도토리 ${post.bounty.awardAmount.toLocaleString()}개를 지급할까요? 채택 후에는 되돌릴 수 없습니다.`)) return;
    setBountyPending(true);setCommentError("");
    try {
      const result=await apiRequest<{ recipientName:string;awardAmount:number }>(`/api/posts/${post.id}/bounty`,{ method:"POST",body:JSON.stringify({ action:"award",commentId }) });
      setNotice(`${result.recipientName}님의 답변을 채택하고 도토리 ${result.awardAmount.toLocaleString()}개를 지급했어요.`);
      const [{ post:nextPost }]=await Promise.all([apiRequest<{ post:Post }>(`/api/posts/${post.id}?trackView=false`),loadComments(pagination.page)]);
      setPost(nextPost);
    } catch(caught) { setCommentError(caught instanceof Error ? caught.message : "현상금을 지급하지 못했습니다."); }
    finally { setBountyPending(false); }
  }
  async function refundBounty() {
    if (!post?.bounty || bountyPending) return;
    setBountyPending(true);setError("");
    try {
      const result=await apiRequest<{ refundAmount:number;burnedAmount:number }>(`/api/posts/${post.id}/bounty`,{ method:"POST",body:JSON.stringify({ action:"refund" }) });
      setNotice(`현상금 ${result.refundAmount.toLocaleString()}개를 환불했어요.${result.burnedAmount ? ` 답변이 있어 ${result.burnedAmount.toLocaleString()}개는 운영 정책에 따라 소각됐어요.` : ""}`);
      const { post:nextPost }=await apiRequest<{ post:Post }>(`/api/posts/${post.id}?trackView=false`);setPost(nextPost);
    } catch(caught) { setError(caught instanceof Error ? caught.message : "현상금을 환불하지 못했습니다."); }
    finally { setBountyPending(false); }
  }
  async function shareWithKakao() {
    if (!post) return;
    const url = window.location.href;
    const javascriptKey = kakaoJavascriptKey;
    try {
      if (!javascriptKey) throw new Error("KAKAO_KEY_MISSING");
      const kakao = await loadKakaoSdk(javascriptKey);
      kakao.Share.sendDefault({
        objectType: "feed",
        content: {
          title: "모두의 일상을 다정하게 담아요, 모두다담",
          description: "반려동물부터 요리, 살림, 취미까지 다양한 일상 이야기를 함께 나누는 커뮤니티입니다.",
          imageUrl: `${window.location.origin}/share-image`,
          imageWidth: 800,
          imageHeight: 400,
          link: { mobileWebUrl: url, webUrl: url },
        },
        buttons: [{ title: "이야기 보러가기", link: { mobileWebUrl: url, webUrl: url } }],
      });
      setShareOpen(false);
    } catch { setNotice("카카오톡 공유를 열지 못했습니다. JavaScript 키와 허용 도메인을 확인해 주세요."); }
  }
  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareOpen(false); setNotice("게시글 주소를 복사했어요.");
    } catch { setNotice("링크를 복사하지 못했습니다."); }
  }
  function openReport(type: "post" | "comment", id: string) {
    if (!authenticated) return requireLogin();
    setReportTarget({ type, id }); setReportReason(""); setReportDetail(""); setReportError("");
  }
  async function submitReport() {
    if (!reportTarget || !reportReason || (reportReason === "기타" && !reportDetail.trim())) return;
    const target = reportTarget;
    const reasonCode = reportReason;
    const reasonDetail = reportDetail;
    setReportSubmitting(true); setReportError("");
    setReportTarget(null); setNotice("신고를 접수하고 있어요.");
    try {
      const path = target.type === "post" ? `/api/posts/${target.id}/report` : `/api/comments/${target.id}/report`;
      await apiRequest(path, { method: "POST", body: JSON.stringify({ reasonCode, reasonDetail }) });
      setNotice("신고가 접수되었습니다.");
    } catch (caught) {
      setNotice(""); setReportTarget(target);
      setReportError(caught instanceof Error ? caught.message : "신고를 접수하지 못했습니다.");
    }
    finally { setReportSubmitting(false); }
  }

  if (error) return <section className="content-page"><div className="board-message error">{error}</div></section>;
  if (!post) return <section className="content-page"><div className="board-message">글을 불러오고 있어요.</div></section>;
  return <article className="content-page post-page">
    <Link className="back-link" href={`/category/${post.categoryCode}`}>‹ {post.categoryName} 게시판</Link>
    <header className="post-header"><h1>{post.title}</h1><div className="post-meta"><small><StampedName full name={post.authorName} stamp={post.authorStampEmoji} /><span>· {new Date(post.createdAt).toLocaleString("ko-KR")} · 조회 {post.viewCount}</span></small>{post.canEdit && <div className="post-owner-actions"><Link href={`/posts/${post.id}/edit`}><Pencil size={14} /> 수정</Link><button type="button" onClick={deletePost} disabled={deletingPost}><Trash2 size={14} /> {deletingPost ? "삭제 중" : "삭제"}</button></div>}</div></header>
    {post.bounty&&<section className={`post-bounty-card ${post.bounty.status}`}><span><HandCoins size={23}/></span><div><small>{post.bounty.status==="open" ? "답변 현상금 모집 중" : post.bounty.status==="awarded" ? "도토리 현상금 지급 완료" : "도토리 현상금 환불 완료"}</small><strong>{post.bounty.amount.toLocaleString()} 🌰</strong><p>{post.bounty.status==="open" ? `채택된 답변자는 ${post.bounty.awardAmount.toLocaleString()}개를 받아요 · ${new Date(post.bounty.expiresAt).toLocaleDateString("ko-KR")}까지` : post.bounty.status==="awarded" ? `${post.bounty.recipientName || "답변자"}님의 답변이 채택되었어요.` : "모집 기간이 끝나 현상금이 환불되었어요."}</p></div>{post.bounty.canRefund&&<button type="button" disabled={bountyPending} onClick={()=>void refundBounty()}>{bountyPending ? "처리 중" : "환불받기"}</button>}</section>}
    <div className="post-content rich-post-content" dangerouslySetInnerHTML={{ __html: post.renderedContentHtml }} />
    <div className="post-community-actions">
      <button type="button" className={post.isLiked ? "active heart" : ""} onClick={toggleLike} disabled={likePending}><Heart size={18} fill={post.isLiked ? "currentColor" : "none"} /><span>좋아요</span><small>{post.likeCount}</small></button>
      <button type="button" className={post.isBookmarked ? "active" : ""} onClick={toggleBookmark} disabled={bookmarkPending}><Bookmark size={18} fill={post.isBookmarked ? "currentColor" : "none"} /><span>스크랩</span><small>{post.bookmarkCount}</small></button>
      <button type="button" onClick={() => setShareOpen(true)}><Share2 size={18} /><span>공유</span></button>
      <button type="button" onClick={() => openReport("post", post.id)}><Flag size={18} /><span>신고</span></button>
    </div>
    <section className="comments-section">
      <h2><MessageCircle size={18} /> 댓글 {pagination.commentCount}</h2>
      {authenticated ? <form className="comment-form" onSubmit={(event) => submitComment(event)}><textarea name="content" required maxLength={3000} rows={3} placeholder="댓글을 입력해 주세요."/><button type="submit">댓글 등록</button></form> : <Link className="comment-login-prompt" href={`/login?returnTo=${encodeURIComponent(`/posts/${postId}`)}`}>댓글을 작성하려면 로그인해 주세요.</Link>}
      {commentError && <div className="form-error comment-error">{commentError}</div>}
      <div className="comment-list">{commentGroups.length === 0 ? <p className="no-comments">첫 댓글을 남겨보세요.</p> : commentGroups.map(({ comment, replies }) => {
        const visibleReplyCount = expandedReplies[comment.id] || Math.min(REPLY_PAGE_SIZE, replies.length);
        return <div className="comment-thread" key={comment.id}>
          <CommentItem comment={comment} reactionPending={reactionPending.has(comment.id)} bountyPending={bountyPending} onAward={awardBounty} onReply={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)} onDelete={deleteComment} onEdit={editComment} onReport={(id) => openReport("comment", id)} onReact={reactToComment} />
          {replyingTo === comment.id && <ReplyForm authorName={comment.authorName} onCancel={() => setReplyingTo(null)} onSubmit={(event) => submitComment(event, comment.id)} />}
          {replies.length > 0 && <div className="reply-list">{replies.slice(0, visibleReplyCount).map((reply) => <div key={reply.id}><CommentItem comment={reply} reply reactionPending={reactionPending.has(reply.id)} bountyPending={bountyPending} onAward={awardBounty} onReply={() => setReplyingTo(replyingTo === reply.id ? null : reply.id)} onDelete={deleteComment} onEdit={editComment} onReport={(id) => openReport("comment", id)} onReact={reactToComment} />{replyingTo === reply.id && <ReplyForm authorName={reply.authorName} onCancel={() => setReplyingTo(null)} onSubmit={(event) => submitComment(event, reply.id)} />}</div>)}</div>}
          {replies.length > REPLY_PAGE_SIZE && <button className="reply-toggle" type="button" onClick={() => setExpandedReplies((current) => ({ ...current, [comment.id]: visibleReplyCount < replies.length ? Math.min(replies.length, visibleReplyCount + REPLY_PAGE_SIZE) : REPLY_PAGE_SIZE }))}><Reply size={14} /> {visibleReplyCount < replies.length ? `답글 ${replies.length - visibleReplyCount}개 더 보기` : "답글 접기"}</button>}
        </div>;
      })}</div>
      <CommentPagination pagination={pagination} onChange={(page) => { setReplyingTo(null); loadComments(page).catch(() => setCommentError("댓글을 불러오지 못했습니다.")); }} />
    </section>
    <DetailBoardList categoryCode={post.categoryCode} currentPostId={post.id} canWrite={post.categoryCode === "notice" ? post.canEdit : authenticated} />
    {notice && <div className="community-toast" role="status">{notice}</div>}
    {shareOpen && <div className="report-backdrop" role="dialog" aria-modal="true" aria-labelledby="share-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setShareOpen(false); }}><section className="share-sheet">
      <span className="sheet-handle" /><h2 id="share-title">공유하기</h2>
      <div className="share-options"><button type="button" onClick={() => void shareWithKakao()}><span className="kakao-share-circle"><KakaoTalkIcon /></span><b>카카오톡</b></button><button type="button" onClick={() => void copyShareLink()}><span className="link-share-circle"><Share2 size={29} /></span><b>링크</b></button></div>
      <button type="button" className="share-cancel" onClick={() => setShareOpen(false)}>취소</button>
    </section></div>}
    {reportTarget && <div className="report-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setReportTarget(null); }}><section className="report-sheet">
      <header><div><h2 id="report-title">{reportTarget.type === "post" ? "이 글 신고하기" : "댓글 신고하기"}</h2><p>신고 사유를 선택해 주세요. 신고 내용은 운영팀이 검토합니다.</p></div><button type="button" onClick={() => setReportTarget(null)} aria-label="신고 창 닫기">×</button></header>
      <div className="report-reasons">{REPORT_REASONS.map((reason) => <label key={reason}><input type="radio" name="report-reason" value={reason} checked={reportReason === reason} onChange={() => { setReportReason(reason); setReportError(""); }} /> {reason}</label>)}</div>
      {reportReason === "기타" && <label className="report-detail"><span>상세 사유</span><textarea value={reportDetail} onChange={(event) => setReportDetail(event.target.value.slice(0, 1000))} rows={4} maxLength={1000} placeholder="신고 사유를 입력해 주세요."/><small>{reportDetail.length}/1,000</small></label>}
      {reportError && <div className="form-error">{reportError}</div>}
      <div className="report-buttons"><button type="button" onClick={() => setReportTarget(null)}>취소</button><button type="button" onClick={submitReport} disabled={reportSubmitting || !reportReason || (reportReason === "기타" && !reportDetail.trim())}>{reportSubmitting ? "제출 중" : "신고 제출"}</button></div>
    </section></div>}
  </article>;
}

function ReplyForm({ authorName, onCancel, onSubmit }: { authorName: string; onCancel: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="comment-form reply-form" onSubmit={onSubmit}><textarea name="content" required maxLength={3000} rows={2} autoFocus placeholder={`${authorName}님에게 답글 작성`} /><div><button type="button" className="reply-cancel" onClick={onCancel}>취소</button><button type="submit">답글 등록</button></div></form>;
}

function CommentItem({ comment, reply = false, reactionPending = false,bountyPending=false,onAward, onReply, onDelete, onEdit, onReport, onReact }: { comment: Comment; reply?: boolean; reactionPending?: boolean;bountyPending?:boolean;onAward:(commentId:string)=>void; onReply: () => void; onDelete: (commentId: string) => void; onEdit: (commentId: string, content: string) => Promise<void>; onReport: (commentId: string) => void; onReact: (commentId: string, reaction: "like" | "dislike") => void }) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [editPending, setEditPending] = useState(false);
  const [editError, setEditError] = useState("");
  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editContent.trim()) return;
    setEditPending(true); setEditError("");
    try { await onEdit(comment.id, editContent.trim()); setEditing(false); }
    catch (caught) { setEditError(caught instanceof Error ? caught.message : "댓글을 수정하지 못했습니다."); }
    finally { setEditPending(false); }
  }
  return <div className={`comment ${reply ? "reply" : ""} ${comment.status === "deleted" ? "deleted" : ""}`}>
    <div className="comment-head"><b>{reply && <Reply size={13} />}<StampedName full name={comment.authorName} stamp={comment.authorStampEmoji} />{comment.helpScore>0&&<em className="help-reputation">도움 신뢰 {comment.helpScore} · 채택 {comment.acceptedAnswers}</em>}{comment.isBountyWinner&&<em className="bounty-winner"><CheckCircle2 size={13}/>채택 답변</em>}</b><small>{new Date(comment.createdAt).toLocaleString("ko-KR")}</small></div>
    {editing ? <form className="comment-edit-form" onSubmit={submitEdit}><textarea value={editContent} onChange={(event) => setEditContent(event.target.value.slice(0, 3000))} rows={3} maxLength={3000}/>{editError && <small className="profile-error">{editError}</small>}<div><button type="button" onClick={() => { setEditing(false); setEditContent(comment.content); setEditError(""); }}>취소</button><button type="submit" disabled={editPending || !editContent.trim()}>{editPending ? "저장 중" : "저장"}</button></div></form> : <p>{reply && comment.replyToId !== comment.parentId && comment.replyToAuthor && <strong className="reply-mention">{comment.replyToStampEmoji && <span className="reply-stamp">{comment.replyToStampEmoji}</span>}@{comment.replyToAuthor}</strong>}{comment.content}</p>}
    {comment.status === "published" && <div className="comment-action-row"><div className="comment-primary-actions">
      <button type="button" disabled={reactionPending} className={comment.myReaction === "like" ? "active" : ""} onClick={() => onReact(comment.id, "like")}><ThumbsUp size={14} /> {comment.likeCount}</button>
      <button type="button" disabled={reactionPending} className={comment.myReaction === "dislike" ? "active" : ""} onClick={() => onReact(comment.id, "dislike")}><ThumbsDown size={14} /> {comment.dislikeCount}</button>
      <button type="button" onClick={onReply}><Reply size={14} /> 답글</button>
      <button type="button" onClick={() => onReport(comment.id)}><Flag size={14} /> 신고</button>
      {comment.canReceiveBounty&&<button type="button" className="bounty-award-button" disabled={bountyPending} onClick={()=>onAward(comment.id)}><HandCoins size={14}/>현상금 채택</button>}
    </div><div className="comment-owner-actions">{comment.canEdit && <button type="button" onClick={() => setEditing(true)}><Pencil size={13} /> 수정</button>}{comment.canDelete && <button type="button" className="comment-delete" onClick={() => onDelete(comment.id)}><Trash2 size={13} /> 삭제</button>}</div></div>}
  </div>;
}

function CommentPagination({ pagination, onChange }: { pagination: Pagination; onChange: (page: number) => void }) {
  const firstPage = Math.max(1, Math.min(pagination.page - 2, pagination.totalPages - 4));
  const pages = Array.from({ length: Math.min(5, pagination.totalPages) }, (_, index) => firstPage + index);
  return <nav className="comment-pagination" aria-label="댓글 페이지"><button type="button" disabled={pagination.page === 1} onClick={() => onChange(pagination.page - 1)} aria-label="이전 댓글 페이지"><ChevronLeft size={16} /></button>{pages.map((page) => <button type="button" key={page} className={page === pagination.page ? "active" : ""} onClick={() => onChange(page)} aria-current={page === pagination.page ? "page" : undefined}>{page}</button>)}<button type="button" disabled={pagination.page === pagination.totalPages} onClick={() => onChange(pagination.page + 1)} aria-label="다음 댓글 페이지"><ChevronRight size={16} /></button></nav>;
}

function KakaoTalkIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#391b1b" d="M24 9.2C14.1 9.2 6 15.5 6 23.2c0 5 3.4 9.4 8.5 11.9l-2.1 7.6c-.2.7.6 1.2 1.2.8l8.9-6.1c.5 0 1 .1 1.5.1 9.9 0 18-6.3 18-14.1S33.9 9.2 24 9.2Z"/>
    <text x="24" y="26.2" fill="#fee500" fontFamily="Arial, sans-serif" fontSize="8.4" fontWeight="900" textAnchor="middle">TALK</text>
  </svg>;
}

async function loadKakaoSdk(javascriptKey: string) {
  const kakaoWindow = window as KakaoWindow;
  if (!kakaoWindow.Kakao) {
    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-sdk="true"]');
      if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("KAKAO_SDK_FAILED")), { once: true }); return; }
      const script = document.createElement("script");
      script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.5/kakao.min.js";
      script.integrity = "sha384-v6JKY3z4FUkWq21oZDHZe74YvuPk/WUrVLrDHTBojHXClOSa3iXy7sCXPY1jkFbj";
      script.crossOrigin = "anonymous"; script.async = true; script.dataset.kakaoSdk = "true";
      script.onload = () => resolve(); script.onerror = () => reject(new Error("KAKAO_SDK_FAILED")); document.head.appendChild(script);
    });
  }
  if (!kakaoWindow.Kakao) throw new Error("KAKAO_SDK_FAILED");
  if (!kakaoWindow.Kakao.isInitialized()) kakaoWindow.Kakao.init(javascriptKey);
  return kakaoWindow.Kakao;
}
