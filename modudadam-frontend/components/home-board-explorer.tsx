"use client";

import Link from "next/link";
import { ChevronRight, HandCoins } from "lucide-react";
import { useMemo, useState } from "react";
import type { HomePost } from "@/app/page";
import { CategoryGrid } from "@/components/category-grid";
import { PostListMeta } from "@/components/post-list-meta";
import { communityBoardChoices } from "@/lib/categories";
import { displayPostTitle } from "@/lib/post-display";

export function HomeBoardExplorer({ posts }: { posts: HomePost[] }) {
  const [selectedCode, setSelectedCode] = useState("pets");
  const selectedBoard = communityBoardChoices.find((board) => board.code === selectedCode) || communityBoardChoices[0];
  const selectedPosts = useMemo(
    () => posts.filter((post) => post.categoryCode === selectedBoard.code).slice(0, 10),
    [posts, selectedBoard.code],
  );
  const Icon = selectedBoard.icon;

  return <div className="home-board-explorer">
    <section className="activity-board-picker home-board-picker">
      <div className="activity-board-picker-heading"><strong>게시판 선택</strong><span>보고 싶은 주제를 선택해 주세요.</span></div>
      <CategoryGrid selectedCode={selectedBoard.code} onSelect={setSelectedCode} className="activity-board-grid" includeCommunityBoards/>
    </section>

    <article className={`home-selected-board board-preview-card board-preview-${selectedBoard.code}`}>
      <header>
        <Link href={`/category/${selectedBoard.code}`}>
          <span className={`board-preview-icon category-${selectedBoard.code}`}><Icon size={16}/></span>
          <span><strong>{selectedBoard.name}</strong><small>{selectedBoard.description}</small></span>
          <ChevronRight size={16}/>
        </Link>
      </header>
      <div className="home-board-explorer-list">
        {selectedPosts.length > 0 ? selectedPosts.map((post) => <Link className={`board-preview-post ${post.isRead ? "is-read" : ""}`} href={`/posts/${post.id}`} key={post.id}>
          <span className="board-preview-title" title={post.title}>{post.bountyAmount>0&&<b className={`bounty-list-badge bounty-tier-${post.bountyAmount}`}><HandCoins size={12}/>{post.bountyAmount.toLocaleString()}</b>}{displayPostTitle(post.title)}</span>
          <PostListMeta className="board-preview-meta" authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/>
        </Link>) : <div className="home-board-explorer-empty"><strong>아직 등록된 글이 없습니다.</strong><span>{selectedBoard.name}의 첫 이야기를 기다리고 있어요.</span></div>}
      </div>
      <footer><Link href={`/category/${selectedBoard.code}`}>{selectedBoard.name} 더 보기 <ChevronRight size={16}/></Link></footer>
    </article>
  </div>;
}
