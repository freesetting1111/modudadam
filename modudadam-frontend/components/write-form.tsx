"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { FileText, ImagePlus, LoaderCircle, X } from "lucide-react";
import { ApiError, apiRequest } from "@/lib/api";

type PostImage = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
};

type EditablePost = {
  id: string;
  title: string;
  content: string;
  categoryCode: string;
  categoryName: string;
  canEdit: boolean;
  images: PostImage[];
};

type SelectedImage = PostImage & {
  localId: string;
  status: "uploading" | "ready" | "error";
  existing: boolean;
  error?: string;
};

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function WriteForm({ initialCategory = "", initialCategoryName = "", postId }: { initialCategory?: string; initialCategoryName?: string; postId?: string }) {
  const router = useRouter();
  const [categoryCode, setCategoryCode] = useState(initialCategory);
  const [categoryName, setCategoryName] = useState(initialCategoryName);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<SelectedImage[]>([]);
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
        setContent(post.content);
        setImages(post.images.map((image) => ({ ...image, localId: image.id, status: "ready", existing: true })));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [postId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!categoryCode || !title.trim() || !content.trim() || images.some((image) => image.status === "uploading")) return;
    setPending(true);
    setError("");
    try {
      const data = await apiRequest<{ id: string }>(postId ? `/api/posts/${postId}` : "/api/posts", {
        method: postId ? "PATCH" : "POST",
        body: JSON.stringify({
          categoryCode,
          title,
          content,
          imageIds: images.filter((image) => image.status === "ready").map((image) => image.id),
        }),
      });
      router.replace(`/posts/${data.id}`);
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 401 ? "로그인이 필요합니다." : caught instanceof Error ? caught.message : "글을 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }

  async function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    if (images.length + files.length > MAX_IMAGES) {
      setError(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }
    const invalid = files.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES);
    if (invalid) {
      setError("JPG, PNG, WebP 형식의 10MB 이하 이미지만 첨부할 수 있습니다.");
      return;
    }
    setError("");
    for (const file of files) {
      const localId = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setImages((current) => [...current, {
        id: "",
        localId,
        url: previewUrl,
        originalName: file.name,
        mimeType: file.type,
        byteSize: file.size,
        status: "uploading",
        existing: false,
      }]);
      void uploadImage(localId, file);
    }
  }

  async function uploadImage(localId: string, file: File) {
    let uploadId = "";
    try {
      const prepared = await apiRequest<{ id: string; uploadUrl: string }>("/api/uploads", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, byteSize: file.size }),
      });
      uploadId = prepared.id;
      const uploaded = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploaded.ok) throw new Error(`S3 업로드에 실패했습니다. (${uploaded.status})`);
      await apiRequest(`/api/uploads/${prepared.id}/complete`, { method: "POST", body: "{}" });
      setImages((current) => current.map((image) => image.localId === localId
        ? { ...image, id: prepared.id, status: "ready" }
        : image));
    } catch (caught) {
      if (uploadId) void apiRequest(`/api/uploads/${uploadId}`, { method: "DELETE" }).catch(() => undefined);
      setImages((current) => current.map((image) => image.localId === localId
        ? { ...image, status: "error", error: caught instanceof Error ? caught.message : "이미지를 업로드하지 못했습니다." }
        : image));
    }
  }

  function removeImage(image: SelectedImage) {
    setImages((current) => current.filter((item) => item.localId !== image.localId));
    if (!image.existing && image.id) void apiRequest(`/api/uploads/${image.id}`, { method: "DELETE" }).catch(() => undefined);
    if (!image.existing && image.url.startsWith("blob:")) URL.revokeObjectURL(image.url);
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
    <div className="compose-field compose-content-field">
      <div className="compose-field-heading"><label htmlFor="post-content">내용 <b>필수</b></label><span>{content.length}/10,000</span></div>
      <textarea id="post-content" value={content} onChange={(event) => setContent(event.target.value)} required maxLength={10000} rows={13} placeholder="함께 나누고 싶은 경험과 정보를 작성해 주세요." />
    </div>
    <div className="compose-field image-attachment-field">
      <div className="compose-field-heading"><label htmlFor="post-images">이미지 <em>선택</em></label><span>{images.length}/{MAX_IMAGES}</span></div>
      <label className={`image-upload-trigger ${images.length >= MAX_IMAGES ? "disabled" : ""}`} htmlFor="post-images">
        <ImagePlus size={20} /><span>이미지 첨부</span><small>JPG, PNG, WebP · 파일당 최대 10MB</small>
      </label>
      <input id="post-images" className="image-file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={images.length >= MAX_IMAGES} onChange={selectImages} />
      {images.length > 0 && <div className="image-preview-list">{images.map((image) => <div className={`image-preview-card ${image.status}`} key={image.localId}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={`${image.originalName} 미리보기`} />
        {image.status === "uploading" && <span className="image-upload-status"><LoaderCircle size={20} /> 업로드 중</span>}
        {image.status === "error" && <span className="image-upload-status error">업로드 실패</span>}
        <button type="button" onClick={() => removeImage(image)} aria-label={`${image.originalName} 삭제`}><X size={16} /></button>
        <small title={image.error || image.originalName}>{image.error || image.originalName}</small>
      </div>)}</div>}
    </div>
    {error && <div className="form-error" role="alert">{error}</div>}
    <div className="write-actions"><Link href={cancelHref}>취소</Link><button type="submit" disabled={pending || images.some((image) => image.status === "uploading") || !title.trim() || !content.trim() || Boolean(error && postId)}>{pending ? "저장 중..." : images.some((image) => image.status === "uploading") ? "이미지 업로드 중" : postId ? "수정 완료" : "등록하기"}</button></div>
  </form>;
}
