"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Post = {
  id: string; title: string; summary: string | null; authorName: string; viewCount: number;
  commentCount: number; createdAt: string; isNotice: boolean; isPinned: boolean;
};

export function BoardList({ categoryCode, categoryName, authenticated }: { categoryCode: string; categoryName: string; authenticated: boolean }) {
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{ posts: Post[] }>(`/api/posts?category=${encodeURIComponent(categoryCode)}&sort=${sort}`)
      .then((data) => { if (active) { setPosts(data.posts); setError(""); } })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "게시글을 불러오지 못했습니다."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [categoryCode, sort]);

  function changeSort(nextSort: "latest" | "popular") {
    if (nextSort === sort) return;
    setLoading(true);
    setSort(nextSort);
  }

  return <>
    <div className="board-toolbar">
      <div className="board-tabs" role="tablist" aria-label="게시글 정렬">
        <button className={sort === "latest" ? "active" : ""} onClick={() => changeSort("latest")}>최신</button>
        <button className={sort === "popular" ? "active" : ""} onClick={() => changeSort("popular")}>인기</button>
      </div>
      {authenticated && <Link className="write-button" href={`/category/${categoryCode}/write`}>글쓰기</Link>}
    </div>
    {loading && <div className="board-message">게시글을 불러오고 있어요.</div>}
    {!loading && error && <div className="board-message error">{error}<small>백엔드가 3004번 포트에서 실행 중인지 확인해 주세요.</small></div>}
    {!loading && !error && posts.length === 0 && <div className="empty-card"><strong>첫 이야기를 기다리고 있어요</strong><p>{categoryName}에 관한 경험과 정보를 나눠보세요.</p>{authenticated && <Link href={`/category/${categoryCode}/write`}>첫 글 작성하기</Link>}</div>}
    {!loading && !error && posts.length > 0 && <div className="board-list">{posts.map((post) =>
      <Link href={`/posts/${post.id}`} className="board-row" key={post.id}>
        <div className="board-row-title">{post.isNotice && <b className="notice-badge">공지</b>}{post.title}</div>
        {post.summary && <p>{post.summary}</p>}
        <small>{post.authorName} · {new Date(post.createdAt).toLocaleDateString("ko-KR")} · 조회 {post.viewCount} · 댓글 {post.commentCount}</small>
      </Link>)}</div>}
  </>;
}
