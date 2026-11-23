"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, HandCoins, MessageCircle, PenLine, ShieldCheck, Sparkles } from "lucide-react";
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
    <section className="bounty-value-grid" aria-label="현상금 질문 이용 방식">
      <article><span><Sparkles size={19}/></span><div><strong>금액순 우선 노출</strong><p>300개, 200개, 100개 순서로 먼저 보여요.</p></div></article>
      <article><span><HandCoins size={19}/></span><div><strong>채택 답변에 보상</strong><p>예치한 도토리의 90%를 답변자가 받아요.</p></div></article>
      <article><span><ShieldCheck size={19}/></span><div><strong>도움 신뢰도 기록</strong><p>채택된 답변은 답변자의 도움 이력으로 남아요.</p></div></article>
    </section>
    <div className="bounty-list-heading"><div><small>OPEN QUESTIONS</small><h2>답변을 기다리는 질문</h2><p>같은 금액에서는 최근 질문이 먼저 표시됩니다.</p></div><Link href="/play/bounties/write"><PenLine size={16}/>질문하기</Link></div>
    {loading&&!data&&<div className="board-message">현상금 질문을 불러오고 있어요.</div>}
    {error&&<div className="board-message error">{error}</div>}
    {!loading&&!error&&data?.posts.length===0&&<div className="bounty-empty"><HandCoins size={30}/><strong>답변을 기다리는 질문이 없습니다</strong><p>경험 있는 이웃의 도움이 필요하다면 첫 질문을 등록해 보세요.</p><Link href="/play/bounties/write">현상금 질문 작성</Link></div>}
    {data&&data.posts.length>0&&<div className="bounty-question-list" aria-busy={loading}>{data.posts.map((post,index)=><Link href={`/posts/${post.id}`} className="bounty-question-card" key={post.id}>
      <span className={`bounty-priority priority-${post.bountyAmount}`}><small>{index<3&&page===1 ? `우선 ${index+1}` : "현상금"}</small><strong>{post.bountyAmount.toLocaleString()}</strong><em>도토리</em></span>
      <span className="bounty-question-copy"><strong>{displayPostTitle(post.title)}</strong><PostListMeta authorName={post.authorName} authorStampEmoji={post.authorStampEmoji} createdAt={post.createdAt} viewCount={post.viewCount} commentCount={post.commentCount}/></span>
      <span className="bounty-answer-count"><MessageCircle size={15}/><b>{post.commentCount}</b><small>답변</small></span>
    </Link>)}</div>}
    {data&&totalPages>1&&<nav className="board-pagination" aria-label="현상금 질문 페이지"><button type="button" disabled={page<=1||loading} onClick={()=>void load(page-1)} aria-label="이전 페이지"><ChevronLeft size={17}/></button><button className="active" type="button" disabled aria-current="page">{page}</button><button type="button" disabled={page>=totalPages||loading} onClick={()=>void load(page+1)} aria-label="다음 페이지"><ChevronRight size={17}/></button></nav>}
  </>;
}
