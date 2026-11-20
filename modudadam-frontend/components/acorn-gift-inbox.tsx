"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, Gift, HandCoins, PackageCheck, PackageOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AchievementDialog } from "@/components/achievement-dialog";
import { apiRequest } from "@/lib/api";

type PendingGift={ id:string;amount:number;message:string|null;senderName:string;giftType:"user"|"signup_package"|"choice_reward";createdAt:string };
type GiftHistory={ id:string;direction:"sent"|"received";amount:number;message:string|null;partnerName:string;status:"sending"|"sent"|"viewed"|"claimed"|"failed";giftType:"user"|"signup_package"|"choice_reward";createdAt:string;claimedAt:string|null };
type GiftPagination={ page:number;pageSize:number;totalItems:number;totalPages:number };
type GiftOverview={ balance:number;pendingGifts:PendingGift[];gifts:GiftHistory[];pendingPagination:GiftPagination };

export function AcornGiftInbox() {
  const [data,setData]=useState<GiftOverview|null>(null);
  const [giftPage,setGiftPage]=useState(1);
  const [pending,setPending]=useState("");
  const [notice,setNotice]=useState("");
  const [celebration,setCelebration]=useState<{ description:string;reward:string }|null>(null);
  const load=useCallback((page=1)=>apiRequest<GiftOverview>(`/api/features/acorn-gifts?inbox=1&page=1&pendingPage=${page}`,{ cache:"no-store" }).then((result)=>{setData(result);window.dispatchEvent(new CustomEvent("modudadam:gift-count-updated",{ detail:{ count:result.pendingPagination.totalItems } }));}).catch((error)=>{setNotice(error instanceof Error?error.message:"선물함을 불러오지 못했습니다.");}),[]);
  useEffect(()=>{void load(giftPage);},[giftPage,load]);

  async function claim(gift:PendingGift) {
    setPending(gift.id);setNotice("");
    try {
      const result=await apiRequest<{ balance:number;amount:number;senderName:string }>("/api/features/acorn-gifts",{ method:"POST",body:JSON.stringify({ action:"claim",giftId:gift.id }) });
      setCelebration({ description:`${result.senderName}님이 보낸 도토리 ${result.amount.toLocaleString()}개를 받았어요.`,reward:`현재 보유 도토리 ${result.balance.toLocaleString()}개` });
      const nextPage=data?.pendingGifts.length===1&&giftPage>1 ? giftPage-1 : giftPage;
      if(nextPage===giftPage) await load(giftPage); else setGiftPage(nextPage);
    } catch(error) { setNotice(error instanceof Error?error.message:"선물을 수령하지 못했습니다."); }
    finally { setPending(""); }
  }

  const received=(data?.gifts || []).filter((gift)=>gift.direction==="received"&&gift.status==="claimed").slice(0,10);
  return <section className="gift-inbox-page">
    <header className="gift-inbox-hero"><span><PackageOpen/></span><div><small>MY GIFT BAG</small><h1>내 선물함</h1><p>도착한 도토리 선물을 확인하고 직접 받아보세요.</p></div><strong>{data?.pendingPagination.totalItems || 0}개</strong></header>
    {!data&&!notice?<div className="feature-loading">선물보따리를 열고 있어요.</div>:<>
      <section className="gift-inbox-pending"><header><div><h2>받지 않은 선물</h2><p>받기를 누르면 내 도토리 지갑에 들어와요.</p></div><span>{data?.pendingPagination.totalItems || 0}</span></header>
        {data?.pendingGifts.length?<div>{data.pendingGifts.map((gift)=><article key={gift.id}><span><Gift/></span><div><small>{giftLabel(gift.giftType)} · {formatDate(gift.createdAt)}</small><strong>{gift.senderName}님이 보낸 도토리 {gift.amount.toLocaleString()}개</strong><p>{gift.message || "도토리 선물이 도착했어요."}</p></div><button type="button" disabled={Boolean(pending)} onClick={()=>void claim(gift)}>{pending===gift.id?"받는 중...":"받기"}</button></article>)}</div>:<div className="gift-inbox-empty"><PackageCheck/><strong>모든 선물을 받았어요.</strong><p>새 선물이 도착하면 헤더에 숫자로 알려드릴게요.</p></div>}
        {data&&data.pendingPagination.totalPages>1&&<nav className="feature-pagination gift-inbox-pagination" aria-label="받지 않은 선물 페이지"><button type="button" disabled={giftPage<=1||Boolean(pending)} onClick={()=>setGiftPage((page)=>page-1)}><ChevronLeft/></button><strong>{giftPage} / {data.pendingPagination.totalPages}</strong><button type="button" disabled={giftPage>=data.pendingPagination.totalPages||Boolean(pending)} onClick={()=>setGiftPage((page)=>page+1)}><ChevronRight/></button></nav>}
      </section>
      <Link className="gift-inbox-send-link" href="/play/acorn-gift"><HandCoins/>나도 도토리 선물하러 가기</Link>
      <section className="gift-inbox-history"><header><h2>최근 받은 선물</h2><span>최근 10건</span></header>{received.length?<div>{received.map((gift)=><article key={gift.id}><span>🌰</span><div><strong>{gift.partnerName}님에게 받은 도토리 {gift.amount.toLocaleString()}개</strong><p>{gift.message}</p></div><time dateTime={gift.claimedAt || gift.createdAt}>{formatDate(gift.claimedAt || gift.createdAt)}</time></article>)}</div>:<p>아직 수령한 선물이 없습니다.</p>}</section>
    </>}
    {notice&&<p className="reward-notice">{notice}</p>}
    <AchievementDialog open={Boolean(celebration)} eyebrow="GIFT RECEIVED" title="선물을 수령 완료했습니다." description={celebration?.description || ""} reward={celebration?.reward} confirmLabel="확인" onConfirm={()=>setCelebration(null)}/>
  </section>;
}

function giftLabel(type:PendingGift["giftType"]) { return type==="signup_package"?"신규가입 패키지":type==="choice_reward"?"극한 밸런스 보상":"도토리 선물"; }
function formatDate(value:string) { return new Intl.DateTimeFormat("ko-KR",{ month:"long",day:"numeric",hour:"2-digit",minute:"2-digit" }).format(new Date(value)); }
