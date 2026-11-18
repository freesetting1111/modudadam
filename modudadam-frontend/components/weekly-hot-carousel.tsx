"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Crown, Eye, MessageCircle, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { HomePost } from "@/app/page";
import { categories } from "@/lib/categories";
import { StampedName } from "@/components/stamped-name";

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
  const [isPaused, setIsPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const groupCount = groups.length;
  const group = groups[activeIndex] || groups[0];
  const category = categories.find((item) => item.code === group?.categoryCode) || categories[0];
  const isHot = variant === "hot";
  const CategoryIcon = category.icon;
  const categoryIconColor = categoryIconColors[category.code] || categoryIconColors.pets;

  const move = (direction: 1 | -1) => {
    setActiveIndex((current) => (current + direction + groupCount) % groupCount);
  };

  useEffect(() => {
    if (groupCount < 2 || isPaused) return;
    const timer = window.setInterval(() => setActiveIndex((current) => (current + 1) % groupCount), 8000);
    return () => window.clearInterval(timer);
  }, [activeIndex, groupCount, isPaused]);

  const togglePaused = () => setIsPaused((current) => !current);

  return <article className={`community-panel ${isHot ? "hot-panel" : "latest-panel"} weekly-hot-carousel ${isPaused ? "is-paused" : ""}`} aria-roledescription="carousel" aria-label={`카테고리별 ${isHot ? "주간 인기 TOP 5" : "NEW 게시글"}`}>
    <header>
      <h1><span className={`board-preview-icon carousel-category-icon category-${category.code}`}><CategoryIcon size={16} style={{ color: categoryIconColor }} /></span><strong className="carousel-heading-text">{isHot ? "주간 인기 TOP 5" : "NEW 게시글"}</strong><span className="carousel-category-name">{category.name}</span></h1>
      <div className="carousel-header-controls">
        <button type="button" className="carousel-play-control" onClick={togglePaused} aria-label={isPaused ? "자동 전환 시작" : "자동 전환 멈춤"} aria-pressed={isPaused}>{isPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}</button>
        <span className="carousel-control-divider" aria-hidden="true" />
        <div className="carousel-navigation">
          <button type="button" onClick={() => move(-1)} aria-label="이전 카테고리"><ChevronLeft size={16} /></button>
          <span>{activeIndex + 1}/{groupCount}</span>
          <button type="button" onClick={() => move(1)} aria-label="다음 카테고리"><ChevronRight size={16} /></button>
        </div>
      </div>
    </header>
    <div className="portal-post-list weekly-hot-slide" key={`${variant}-${category.code}`}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const distance = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        touchStart.current = null;
        if (Math.abs(distance) >= 45) move(distance < 0 ? 1 : -1);
      }}>
      {group?.posts.length ? group.posts.map((post, index) => <CarouselPost key={post.id} post={post} rank={isHot ? index + 1 : undefined} />) : <div className="weekly-hot-empty"><CategoryIcon size={20} /><strong>{category.name}</strong><span>{isHot ? "이번 주 인기 게시글이 없습니다." : "최근 등록된 게시글이 없습니다."}</span></div>}
    </div>
  </article>;
}

function CarouselPost({ post, rank }: { post: HomePost; rank?: number }) {
  return <Link href={`/posts/${post.id}`} className={`portal-post-row ${rank ? "has-rank" : ""} ${post.isRead ? "is-read" : ""}`}>
    {rank && <strong className={`portal-rank ${rank <= 3 ? `medal-rank medal-rank-${rank}` : ""}`}>{rank <= 3 && <Crown className="rank-crown" size={14} aria-hidden="true" />}{rank}</strong>}
    <div className="portal-post-copy">
      <div className="portal-post-title"><span>{post.title}</span></div>
      <div className="portal-post-meta"><StampedName className="portal-author" name={post.authorName} stamp={post.authorStampEmoji} /><time dateTime={post.createdAt}>{formatCompactDate(post.createdAt)}</time><span><Eye size={13}/>{post.viewCount}</span><span><MessageCircle size={13}/>{post.commentCount}</span></div>
    </div>
  </Link>;
}

function formatCompactDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date.getMonth() + 1}.${date.getDate()}`;
}
