"use client";

import Link from "next/link";
import { Crown, HandCoins } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HomePost } from "@/app/page";
import { categories } from "@/lib/categories";
import { PostListMeta } from "@/components/post-list-meta";
import { displayPostTitle } from "@/lib/post-display";

type WeeklyGroup = { categoryCode: string; posts: HomePost[] };

const categoryIconColors: Record<string, string> = {
  pets: "#db6248", food: "#e5812c", home: "#258e7c", hobby: "#8b66cf",
  travel: "#3d79cf", wellness: "#398c56", family: "#d46278", mobility: "#4f6fb7",
  style: "#bd5a96", learning: "#b77a18", local: "#2188a1", culture: "#7063bd",
  society: "#4f6b8a", "ai-tech": "#6260c5", finance: "#297c63", career: "#a05d35",
};

export function CategoryPostCarousels({ hotGroups, latestGroups }: { hotGroups: WeeklyGroup[]; latestGroups: WeeklyGroup[] }) {
  return <>
    <CategoryPostPanel groups={hotGroups} variant="hot" />
    <CategoryPostPanel groups={latestGroups} variant="latest" />
  </>;
}

function CategoryPostPanel({ groups, variant }: { groups: WeeklyGroup[]; variant: "hot" | "latest" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const groupCount = groups.length;
  const group = groups[activeIndex] || groups[0];
  const category = categories.find((item) => item.code === group?.categoryCode) || categories[0];
  const isHot = variant === "hot";
  const CategoryIcon = category.icon;
  const categoryIconColor = categoryIconColors[category.code] || categoryIconColors.pets;

  const move = (direction: 1 | -1) => {
    if (groupCount < 2) return;
    setActiveIndex((current) => (current + direction + groupCount) % groupCount);
  };

  useEffect(() => {
    if (groupCount < 2) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % groupCount), 8000);
    return () => window.clearInterval(timer);
  }, [activeIndex, groupCount]);

  return <article className={`community-panel ${isHot ? "hot-panel" : "latest-panel"} weekly-hot-carousel`} aria-roledescription="carousel" aria-label={`카테고리별 ${isHot ? "주간 인기 TOP 5" : "NEW 게시글"}`}>
    <header>
      <h2><span className={`board-preview-icon carousel-category-icon category-${category.code}`}><CategoryIcon size={16} style={{ color: categoryIconColor }} /></span><strong className="carousel-heading-text">{isHot ? "주간 인기 TOP 5" : "NEW 게시글"}</strong><span className="carousel-category-name">{category.name}</span></h2>
      <span className="carousel-position" aria-label={`${groupCount}개 게시판 중 ${activeIndex + 1}번째`}>{activeIndex + 1}/{groupCount}</span>
    </header>
    <div className="portal-post-list weekly-hot-slide" key={`${variant}-${category.code}`}
      tabIndex={0}
      aria-label="좌우로 밀어 다른 게시판의 글 보기"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") move(-1);
        if (event.key === "ArrowRight") move(1);
      }}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        dragStart.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        if (!dragStart.current) return;
        const distanceX = event.clientX - dragStart.current.x;
        const distanceY = event.clientY - dragStart.current.y;
        dragStart.current = null;
        if (Math.abs(distanceX) >= 45 && Math.abs(distanceX) > Math.abs(distanceY)) {
          suppressClickUntil.current = Date.now() + 400;
          move(distanceX < 0 ? 1 : -1);
        }
      }}
      onPointerCancel={() => { dragStart.current = null; }}
      onClickCapture={(event) => {
        if (Date.now() > suppressClickUntil.current) return;
        event.preventDefault();
        event.stopPropagation();
        suppressClickUntil.current = 0;
      }}>
      {group?.posts.length ? group.posts.map((post, index) => <CarouselPost key={post.id} post={post} rank={isHot ? index + 1 : undefined} featured={index === 0} />) : <div className="weekly-hot-empty"><CategoryIcon size={20} /><strong>{category.name}</strong><span>{isHot ? "이번 주 인기 게시글이 없습니다." : "최근 등록된 게시글이 없습니다."}</span></div>}
    </div>
  </article>;
}

function CarouselPost({ post, rank, featured }: { post: HomePost; rank?: number; featured:boolean }) {
  return <Link href={`/posts/${post.id}`} className={`portal-post-row ${rank ? "has-rank" : ""} ${featured ? "is-featured" : ""} ${post.isRead ? "is-read" : ""}`}>
    {rank && <strong className={`portal-rank ${rank <= 3 ? `medal-rank medal-rank-${rank}` : ""}`}>{rank <= 3 && <Crown className="rank-crown" size={14} aria-hidden="true" />}{rank}</strong>}
    <div className="portal-post-copy">
      <div className="portal-post-title"><span title={post.title}>{post.bountyAmount>0&&<b className={`bounty-list-badge bounty-tier-${post.bountyAmount}`}><HandCoins size={11}/>{post.bountyAmount.toLocaleString()}</b>}{displayPostTitle(post.title)}</span></div>
      <PostListMeta className="portal-post-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/>
    </div>
  </Link>;
}
