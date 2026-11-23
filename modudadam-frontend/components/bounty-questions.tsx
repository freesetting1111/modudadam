"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, HandCoins, MessageCircle, PenLine } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { PostListMeta } from "@/components/post-list-meta";
import { displayPostTitle } from "@/lib/post-display";

type BountyPost={
  id:string;title:string;authorName:string;authorStampEmoji:string|null;createdAt:string;
  viewCount:number;commentCount:number;bountyAmount:number;
};
type BountyPage={ posts:BountyPost[];pagination:{ page:number;pageSize:number;totalItems:number;totalPages:number } };

export function BountyQuestions() {
  const [data,setData]=useState<BountyPage|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const load=useCallback(async(page=1)=>{
    setLoading(true);setError("");
    try {
      const params=new URLSearchParams({ category:"bounty",bountyOnly:"true",sort:"bounty",limit:"10",page:String(page) });
      setData(await apiRequest<BountyPage>(`/api/posts?${params}`));
      if(page>1) window.scrollTo({ top:0,behavior:"smooth" });
    } catch(caught) { setError(caught instanceof Error ? caught.message : "현상금 질문을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{
    let active=true;
    const params=new URLSearchParams({ category:"bounty",bountyOnly:"true",sort:"bounty",limit:"10",page:"1" });
    void apiRequest<BountyPage>(`/api/posts?${params}`)
      .then((result)=>{if(active){setData(result);setError("");}})
      .catch((caught)=>{if(active)setError(caught instanceof Error ? caught.message : "현상금 질문을 불러오지 못했습니다.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[]);

  const page=data?.pagination.page||1;
  const totalPages=data?.pagination.totalPages||1;
  return <>
    <div className="bounty-rule-strip"><span>300 · 200 · 100 순 노출</span><span>채택 보상 90%</span><span>모집 7일</span></div>
    <div className="bounty-list-heading"><h2>답변 대기 중</h2><Link href="/play/bounties/write"><PenLine size={16}/>질문하기</Link></div>
    {loading&&!data&&<div className="board-message">현상금 질문을 불러오고 있어요.</div>}
    {error&&<div className="board-message error">{error}</div>}
    {!loading&&!error&&data?.posts.length===0&&<div className="bounty-empty"><HandCoins size={30}/><strong>등록된 질문이 없습니다</strong><Link href="/play/bounties/write">질문 작성</Link></div>}
    {data&&data.posts.length>0&&<div className="bounty-question-list" aria-busy={loading}>{data.posts.map((post,index)=><Link href={`/posts/${post.id}`} className="bounty-question-card" key={post.id}>
      <span className={`bounty-priority priority-${post.bountyAmount}`}><small>{index<3&&page===1 ? `우선 ${index+1}` : "현상금"}</small><strong>{post.bountyAmount.toLocaleString()}</strong><em>도토리</em></span>
      <span className="bounty-question-copy"><strong>{displayPostTitle(post.title)}</strong><PostListMeta authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/></span>
      <span className="bounty-answer-count"><MessageCircle size={15}/><b>{post.commentCount}</b><small>답변</small></span>
    </Link>)}</div>}
    {data&&totalPages>1&&<nav className="board-pagination" aria-label="현상금 질문 페이지"><button type="button" disabled={page<=1||loading} onClick={()=>void load(page-1)} aria-label="이전 페이지"><ChevronLeft size={17}/></button><button className="active" type="button" disabled aria-current="page">{page}</button><button type="button" disabled={page>=totalPages||loading} onClick={()=>void load(page+1)} aria-label="다음 페이지"><ChevronRight size={17}/></button></nav>}
  </>;
}
