"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api";
import { categories } from "@/lib/categories";

export function WriteForm({ initialCategory }: { initialCategory?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loginRequired, setLoginRequired] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError(""); setLoginRequired(false);
    try {
      const data = await apiRequest<{ id: string }>("/api/posts", { method: "POST", body: JSON.stringify({
        categoryCode: form.get("categoryCode"), title: form.get("title"), summary: form.get("summary"), content: form.get("content"),
      }) });
      router.push(`/posts/${data.id}`);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) setLoginRequired(true);
      setError(caught instanceof Error ? caught.message : "글을 저장하지 못했습니다.");
    } finally { setPending(false); }
  }

  return <form className="write-form" onSubmit={submit}>
    <label>게시판<select name="categoryCode" defaultValue={initialCategory || categories[0].code}>{categories.map((category) => <option key={category.code} value={category.code}>{category.name}</option>)}</select></label>
    <label>제목<input name="title" required maxLength={200} placeholder="제목을 입력해 주세요" /></label>
    <label>한 줄 요약 <small>선택</small><input name="summary" maxLength={500} placeholder="목록에 표시할 간단한 설명" /></label>
    <label>내용<textarea name="content" required rows={14} placeholder="경험과 정보를 자세히 나눠주세요." /></label>
    {error && <div className="form-error" role="alert">{error}{loginRequired && <> <Link href={`/login?returnTo=${encodeURIComponent(`/write?category=${initialCategory || "pets"}`)}`}>로그인하기</Link></>}</div>}
    <button type="submit" disabled={pending}>{pending ? "등록 중..." : "게시글 등록"}</button>
  </form>;
}
