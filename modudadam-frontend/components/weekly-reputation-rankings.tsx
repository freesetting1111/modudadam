"use client";

import Link from "next/link";
import { Crown, Flag, HeartHandshake, ShieldCheck, Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { StampedName } from "@/components/stamped-name";

type RankItem = { userId:string;nickname:string;stampEmoji:string|null;score:number;voteCount?:number };
type RankingData = { kindness:RankItem[];misdeed:RankItem[];myVoteCandidateId:string|null;myPoints:{ kindnessPoints:number;misdeedPoints:number }|null;votingEnabled:boolean };

export function WeeklyReputationRankings() {
  const [data,setData]=useState<RankingData|null>(null);
  const [pending,setPending]=useState("");
  const [error,setError]=useState("");
  const load=useCallback(() => apiRequest<RankingData>("/api/features/reputation-rankings",{ cache:"no-store" }).then(setData).catch(() => setError("주간 랭킹을 불러오지 못했어요.")),[]);
  useEffect(() => { void load(); },[load]);

  async function vote(candidateUserId:string) {
    if (!data?.votingEnabled) return;
    setPending(candidateUserId);setError("");
    try { await apiRequest("/api/features/reputation-rankings",{ method:"POST",body:JSON.stringify({ candidateUserId }) });await load(); }
    catch(caught) { setError(caught instanceof ApiError && caught.status===401 ? "투표하려면 로그인이 필요해요." : caught instanceof Error ? caught.message : "투표하지 못했어요."); }
    finally { setPending(""); }
  }

  return <section className="weekly-reputation" aria-label="주간 선행과 악행 랭킹">
    <header><div className="weekly-reputation-heading"><span><Sparkles size={20}/></span><div><small>주간 집계</small><h2>이번 주 다담 랭킹</h2></div></div>{data?.myPoints && <span className="weekly-my-score"><small>내 점수</small><b>선행 {data.myPoints.kindnessPoints.toLocaleString()}</b><i/>악행 {data.myPoints.misdeedPoints.toLocaleString()}</span>}</header>
    <div className="weekly-reputation-grid">
      <RankingPanel tone="kindness" title="선행 TOP 5" description="도토리 10개를 나눈 횟수" icon={<HeartHandshake/>} items={data?.kindness || []}/>
      <RankingPanel tone="misdeed" title="악행 TOP 5" description="운영자가 유효 처리한 신고만 반영" icon={<Flag/>} items={data?.misdeed || []} vote={{ enabled:Boolean(data?.votingEnabled),selectedId:data?.myVoteCandidateId || null,pending,onVote:vote }}/>
    </div>
    {!data?.votingEnabled && <p className="ranking-login"><ShieldCheck size={14}/><Link href="/login?returnTo=/">로그인하면 이번 주 악행 후보에게 투표할 수 있어요.</Link></p>}
    {error && <p className="ranking-error">{error}</p>}
  </section>;
}

function RankingPanel({ tone,title,description,icon,items,vote }:{ tone:"kindness"|"misdeed";title:string;description:string;icon:ReactNode;items:RankItem[];vote?:{ enabled:boolean;selectedId:string|null;pending:string;onVote:(id:string)=>void } }) {
  return <article className={`weekly-rank-panel ${tone}`}><header><span>{icon}</span><div><small>{tone === "kindness" ? "선행" : "악행"}</small><h3>{title}</h3><p>{description}</p></div></header><div className="weekly-rank-list">{items.length ? items.map((item,index) => <div key={item.userId} className={`${vote?.selectedId===item.userId ? "selected " : ""}rank-row rank-${index+1}`}><b className="rank-position">{index < 3 && <Crown size={12}/>}<span>{index+1}</span></b><StampedName name={item.nickname} stamp={item.stampEmoji}/><small className="rank-score">{tone==="kindness" ? <><strong>{item.score}</strong>회 나눔</> : <>유효 <strong>{item.score}</strong>건 · {item.voteCount || 0}표</>}</small>{vote && <button type="button" disabled={!vote.enabled || Boolean(vote.selectedId) || Boolean(vote.pending)} onClick={() => vote.onVote(item.userId)}>{vote.selectedId===item.userId ? "투표 완료" : vote.pending===item.userId ? "투표 중" : "투표"}</button>}</div>) : <p className="weekly-rank-empty">집계 내역이 없습니다.</p>}</div></article>;
}
