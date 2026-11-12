"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";

type EditablePost = {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  categoryCode: string;
  categoryName: string;
  canEdit: boolean;
};

export function WriteForm({ initialCategory = "", initialCategoryName = "", postId }: { initialCategory?: string; initialCategoryName?: string; postId?: string }) {
  const router = useRouter();
  const [categoryCode, setCategoryCode] = useState(initialCategory);
  const [categoryName, setCategoryName] = useState(initialCategoryName);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(Boolean(postId));

  useEffect(() => {
    if (!postId) return;
    apiRequest<{ post: EditablePost }>(`/api/posts/${postId}?trackView=false`)
      .then(({ post }) => {
        if (!post.canEdit) throw new Error("수정 권한이 없습니다.");
        setCategoryCode(post.categoryCode);
        setCategoryName(post.categoryName);
        setTitle(post.title);
        setSummary(post.summary || "");
        setContent(post.content);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [postId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryCode || !title.trim() || !content.trim()) return;
    setPending(true);
    setError("");
    try {
      const data = await apiRequest<{ id: string }>(postId ? `/api/posts/${postId}` : "/api/posts", {
        method: postId ? "PATCH" : "POST",
        body: JSON.stringify({ categoryCode, title, summary, content }),
      });
      router.replace(`/posts/${data.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401 ? "로그인이 필요합니다." : caught instanceof Error ? caught.message : "글을 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  const cancelHref = postId ? `/posts/${postId}` : `/category/${categoryCode}`;
  if (loading) return <div className="board-message">게시글을 불러오고 있어요.</div>;

  return <form className="write-form compose-form" onSubmit={submit}>
    <div className="write-board-label">
      <span className="write-board-symbol"><FileText size={19} /></span>
      <span><small>작성 게시판</small><strong>{categoryName}</strong></span>
      <b>전체 공개</b>
    </div>
    <div className="compose-field">
      <div className="compose-field-heading"><label htmlFor="post-title">제목 <b>필수</b></label><span>{title.length}/200</span></div>
      <input id="post-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} placeholder="제목을 입력해 주세요" />
    </div>
    <div className="compose-field">
      <div className="compose-field-heading"><label htmlFor="post-summary">한 줄 요약 <em>선택</em></label><span>{summary.length}/500</span></div>
      <input id="post-summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={500} placeholder="목록에서 내용을 쉽게 알 수 있도록 요약해 주세요" />
    </div>
    <div className="compose-field compose-content-field">
      <div className="compose-field-heading"><label htmlFor="post-content">내용 <b>필수</b></label><span>{content.length}/10,000</span></div>
      <textarea id="post-content" value={content} onChange={(event) => setContent(event.target.value)} required maxLength={10000} rows={13} placeholder="함께 나누고 싶은 경험과 정보를 작성해 주세요." />
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="write-actions"><Link href={cancelHref}>취소</Link><button type="submit" disabled={pending || !title.trim() || !content.trim() || Boolean(error && postId)}>{pending ? "저장 중..." : postId ? "수정 완료" : "등록하기"}</button></div>
  </form>;
}
