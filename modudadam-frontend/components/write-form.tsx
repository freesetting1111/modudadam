"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { FileText } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";
import { EditorImage, EditorValue, PreparedEditorValue, RichPostEditor, RichPostEditorHandle } from "@/components/rich-post-editor";

type EditablePost = {
  id: string;
  title: string;
  content: string;
  attributes?: { contentHtml?: string };
  categoryCode: string;
  categoryName: string;
  canEdit: boolean;
  images: EditorImage[];
};

const EMPTY_EDITOR: EditorValue = {
  content: "",
  contentHtml: "<p><br></p>",
  imageIds: [],
  imageCount: 0,
  uploading: false,
};

export function WriteForm({ initialCategory = "", initialCategoryName = "", postId }: { initialCategory?: string; initialCategoryName?: string; postId?: string }) {
  const router = useRouter();
  const editorRef = useRef<RichPostEditorHandle>(null);
  const [categoryCode, setCategoryCode] = useState(initialCategory);
  const [categoryName, setCategoryName] = useState(initialCategoryName);
  const [title, setTitle] = useState("");
  const [editorValue, setEditorValue] = useState<EditorValue>(EMPTY_EDITOR);
  const [initialContent, setInitialContent] = useState("");
  const [initialContentHtml, setInitialContentHtml] = useState("");
  const [initialImages, setInitialImages] = useState<EditorImage[]>([]);
  const [editorResetKey, setEditorResetKey] = useState(postId ? "loading" : "new");
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
        setInitialContent(post.content);
        setInitialContentHtml(post.attributes?.contentHtml || "");
        setInitialImages(post.images);
        setEditorResetKey(`post-${post.id}`);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [postId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryCode || !title.trim()) {
      setError("제목을 입력해 주세요.");
      return;
    }
    if (!editorValue.content.trim()) {
      setError("내용을 입력해 주세요.");
      return;
    }
    if (editorValue.uploading) {
      setError("본문 이미지 업로드가 끝날 때까지 기다려 주세요.");
      return;
    }
    setPending(true);
    setError("");
    let prepared: PreparedEditorValue | null = null;
    try {
      if (!editorRef.current) throw new Error("본문 편집기를 준비하지 못했습니다.");
      prepared = await editorRef.current.prepareForSubmit();
      const data = await apiRequest<{ id: string }>(postId ? `/api/posts/${postId}` : "/api/posts", {
        method: postId ? "PATCH" : "POST",
        body: JSON.stringify({
          categoryCode,
          title,
          content: prepared.value.content,
          contentHtml: prepared.value.contentHtml,
          imageIds: prepared.value.imageIds,
        }),
      });
      editorRef.current.commitUploads(prepared.newUploadIds);
      router.replace(`/posts/${data.id}`);
    } catch (caught) {
      if (prepared?.newUploadIds.length) await editorRef.current?.rollbackUploads(prepared.newUploadIds);
      setError(caught instanceof ApiError && caught.status === 401 ? "로그인이 필요합니다." : caught instanceof Error ? caught.message : "글을 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  const cancelHref = postId ? `/posts/${postId}` : `/category/${categoryCode}`;
  const contentLength = Array.from(editorValue.content).length;
  const canSubmit = !pending && !editorValue.uploading && Boolean(title.trim()) && contentLength > 0 && contentLength <= 20000;
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
    <div className="compose-field compose-content-field rich-compose-field">
      <div className="compose-field-heading"><label>내용 <b>필수</b></label><span className={contentLength > 20000 ? "limit-error" : ""}>{contentLength.toLocaleString()}/20,000</span></div>
      <RichPostEditor
        ref={editorRef}
        initialContent={initialContent}
        initialContentHtml={initialContentHtml}
        initialImages={initialImages}
        resetKey={editorResetKey}
        disabled={pending}
        onChange={setEditorValue}
        onError={setError}
      />
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="write-actions"><Link href={cancelHref}>취소</Link><button type="submit" disabled={!canSubmit}>{pending ? "이미지 업로드 및 저장 중..." : postId ? "수정 완료" : "등록하기"}</button></div>
  </form>;
}
