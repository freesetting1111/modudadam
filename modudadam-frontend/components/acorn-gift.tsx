"use client";

import { ArrowDownLeft, ArrowUpRight, Check, HandCoins, Package, PackageOpen, Search, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { StampedName } from "@/components/stamped-name";
import { AchievementDialog } from "@/components/achievement-dialog";

type GiftHistory = { id:string;direction:"sent"|"received";amount:number;message:string|null;partnerName:string;partnerStampEmoji:string|null;status:"pending"|"claimed";giftType:"user"|"signup_package"|"choice_reward";createdAt:string;claimedAt:string|null };
type PendingGift = { id:string;amount:number;message:string|null;senderName:string;senderStampEmoji:string|null;giftType:"user"|"signup_package"|"choice_reward";createdAt:string };
type GiftOverview = { balance:number;kindnessPoints:number;misdeedPoints:number;pendingGifts:PendingGift[];gifts:GiftHistory[] };
type Recipient = { nickname:string;stampEmoji:string|null };

export function AcornGift() {
  const router=useRouter();
  const [overview,setOverview]=useState<GiftOverview | null>(null);
  const [nickname,setNickname]=useState("");
  const [recipient,setRecipient]=useState<Recipient | null>(null);
  const [message,setMessage]=useState("");
  const [giftAmount,setGiftAmount]=useState("10");
  const [giftConfirm,setGiftConfirm]=useState(false);
  const [pending,setPending]=useState("load");
  const [bagOpen,setBagOpen]=useState(false);
  const [notice,setNotice]=useState("");
  const [celebration,setCelebration]=useState<{ title:string;description:string;reward:string } | null>(null);
  const requestRef=useRef<{ payload:string;key:string } | null>(null);
  const giftAmountNumber=Number(giftAmount);
  const expectedKindnessPoints=Number.isInteger(giftAmountNumber)&&giftAmountNumber>=10&&giftAmountNumber%10===0
    ? Math.min(giftAmountNumber/10,Math.max(0,20000-(overview?.kindnessPoints || 0)))
    : 0;

  const handleError=useCallback((error:unknown,fallback:string) => {
    if (error instanceof ApiError && error.status===401) { router.replace(`/login?returnTo=${encodeURIComponent("/play/acorn-gift")}`); return; }
    setNotice(error instanceof Error ? error.message : fallback);
  },[router]);
  const load=useCallback(() => apiRequest<GiftOverview>("/api/features/acorn-gifts",{ cache:"no-store" }).then(setOverview).catch((error) => handleError(error,"도토리 선물함을 불러오지 못했습니다.")).finally(() => setPending("")),[handleError]);
  useEffect(() => { void load(); },[load]);

  async function findRecipient() {
    if (!nickname.trim()) { setNotice("받는 분의 닉네임을 입력해 주세요.");return; }
    setPending("search");setNotice("");setRecipient(null);
    try {
      const data=await apiRequest<{ recipient:Recipient }>(`/api/features/acorn-gifts?nickname=${encodeURIComponent(nickname.trim())}`,{ cache:"no-store" });
      setRecipient(data.recipient);setNickname(data.recipient.nickname);
    } catch(error) { handleError(error,"사용자를 찾지 못했습니다."); } finally { setPending(""); }
  }

  async function sendGift() {
    const amount=Number(giftAmount);
    if (!recipient || recipient.nickname.toLowerCase()!==nickname.trim().toLowerCase()) { setNotice("받는 분을 다시 확인해 주세요.");return; }
    if (!Number.isInteger(amount)||amount<10||amount>20000||amount%10!==0) { setNotice("도토리는 10개 단위로 입력해 주세요.");return; }
    if ((overview?.balance || 0)<amount) { setNotice("보유한 도토리가 부족합니다.");return; }
    setPending("send");setNotice("");
    try {
      const payload=JSON.stringify({ nickname:recipient.nickname,amount,message });
      if (requestRef.current?.payload!==payload) requestRef.current={ payload,key:crypto.randomUUID() };
      const result=await apiRequest<{ balance:number;recipientName:string;kindnessPoints:number;awardedKindnessPoints:number;newStamps:Array<{ name:string }> }>("/api/features/acorn-gifts",{ method:"POST",body:JSON.stringify({ nickname:recipient.nickname,amount,message,requestKey:requestRef.current.key }) });
      setGiftConfirm(false);setNotice(`${result.recipientName}님에게 도토리 ${amount.toLocaleString()}개를 선물했어요.`);
      setCelebration({ title:`${result.recipientName}님에게 도토리를 선물했습니다!`,description:result.newStamps.length ? `${result.newStamps.map((stamp) => stamp.name).join(", ")} 특별 스탬프도 함께 획득했어요.` : `상대방의 선물보따리에 도토리 ${amount.toLocaleString()}개를 담았어요.`,reward:`선행 포인트 +${result.awardedKindnessPoints.toLocaleString()} · 현재 ${result.kindnessPoints.toLocaleString()}점` });
      requestRef.current=null;setNickname("");setRecipient(null);setMessage("");setGiftAmount("10");await load();
    } catch(error) { setGiftConfirm(false);handleError(error,"도토리 선물을 보내지 못했습니다."); } finally { setPending(""); }
  }

  function requestGift() { const amount=Number(giftAmount);setNotice("");if(!recipient||recipient.nickname.toLowerCase()!==nickname.trim().toLowerCase()){setNotice("받는 분을 다시 확인해 주세요.");return;}if(!Number.isInteger(amount)||amount<10||amount>20000||amount%10!==0){setNotice("도토리는 10개 단위로 입력해 주세요.");return;}if((overview?.balance||0)<amount){setNotice("보유한 도토리가 부족합니다.");return;}setGiftConfirm(true); }

  async function claimGift(gift:PendingGift) {
    setPending(`claim:${gift.id}`);setNotice("");
    try {
      const result=await apiRequest<{ balance:number;amount:number;senderName:string }>("/api/features/acorn-gifts",{ method:"POST",body:JSON.stringify({ action:"claim",giftId:gift.id }) });
      setCelebration({ title:"선물을 수령 완료했습니다.",description:`${result.senderName}님이 보낸 도토리 ${result.amount.toLocaleString()}개를 받았어요.`,reward:`현재 보유 도토리 ${result.balance.toLocaleString()}개` });
      await load();
    } catch(error) { handleError(error,"선물을 수령하지 못했습니다."); } finally { setPending(""); }
  }

  return <section className="dadam-feature-page acorn-gift-page">
    <header className="dadam-feature-hero"><span><HandCoins size={26}/></span><div><small>ACORN GIFT</small><h1>도토리 선물하기</h1><p>고마운 이웃에게 따뜻한 메시지와 함께 도토리를 보내보세요.</p></div></header>
    <article className="gift-wallet"><span>🌰</span><div><small>보유 도토리</small><strong>{overview?.balance.toLocaleString() ?? "-"}개</strong></div><div><small>선행 포인트</small><strong>{overview?.kindnessPoints.toLocaleString() ?? "-"}점</strong></div><div><small>악행 포인트</small><strong>{overview?.misdeedPoints.toLocaleString() ?? "-"}점</strong></div></article>
    <section className={`gift-bag ${bagOpen ? "open" : ""}`}>
      <button className="gift-bag-toggle" type="button" aria-expanded={bagOpen} onClick={() => setBagOpen((open) => !open)}><span>{bagOpen ? <PackageOpen size={24}/> : <Package size={24}/>}</span><div><strong>내 선물보따리</strong><small>받지 않은 도토리 선물을 확인해 보세요.</small></div><b>{overview?.pendingGifts.length || 0}개</b></button>
      {bagOpen && <div className="gift-bag-items">{overview?.pendingGifts.length ? overview.pendingGifts.map((gift) => <article key={gift.id}><span><PackageOpen size={22}/></span><div><small>{gift.giftType==="signup_package" ? "신규가입 패키지" : gift.giftType==="choice_reward" ? "극한 밸런스 보상" : formatDate(gift.createdAt)}</small><strong>{gift.senderName}님이 보낸 도토리 {gift.amount.toLocaleString()}개</strong><p>{gift.message}</p></div><button type="button" disabled={pending===`claim:${gift.id}`} onClick={() => void claimGift(gift)}>{pending===`claim:${gift.id}` ? "받는 중" : "받기"}</button></article>) : <div className="gift-bag-empty">지금은 기다리고 있는 선물이 없어요.</div>}</div>}
    </section>
    <div className="acorn-gift-form">
      <label><span>받는 분 닉네임</span><div><input value={nickname} maxLength={60} placeholder="닉네임을 정확히 입력해 주세요" onChange={(event) => { setNickname(event.target.value);setRecipient(null); }} onKeyDown={(event) => { if(event.key==="Enter") void findRecipient(); }}/><button type="button" disabled={pending==="search"} onClick={() => void findRecipient()}><Search size={17}/>{pending==="search" ? "확인 중" : "확인"}</button></div></label>
      {recipient && <div className="gift-recipient"><Check size={17}/><span><StampedName full name={recipient.nickname} stamp={recipient.stampEmoji}/></span><small>선물 받을 사용자</small></div>}
      <label><span>선물할 도토리 <small>10개 단위</small></span><div className="gift-amount"><input type="number" inputMode="numeric" min={10} max={20000} step={10} value={giftAmount} onChange={(event)=>setGiftAmount(event.target.value.replace(/\D/g,"").slice(0,5))}/><b>개</b></div></label>
      <div className="gift-quick-amounts">{[10,100,500,1000].map((amount)=><button type="button" key={amount} disabled={(overview?.balance||0)<amount} onClick={()=>setGiftAmount(String(amount))}>{amount.toLocaleString()}개</button>)}</div>
      <div className="gift-point-preview"><span>예상 선행 포인트</span><strong>+{expectedKindnessPoints.toLocaleString()}점</strong><small>도토리 10개를 선물할 때마다 1점씩, 최대 보유 한도 20,000점까지 받아요.</small></div>
      <label><span>함께 보낼 메시지 <small>{message.length}/80</small></span><textarea rows={3} maxLength={80} value={message} placeholder="짧은 마음을 남겨보세요. (선택)" onChange={(event) => setMessage(event.target.value)}/></label>
      <button className="gift-send-button" type="button" disabled={!recipient || pending==="send"} onClick={requestGift}><Send size={18}/>{pending==="send" ? "선물 보내는 중..." : `도토리 ${(Number(giftAmount)||0).toLocaleString()}개 선물하기`}</button>
    </div>
    {notice && <p className="reward-notice">{notice}</p>}
    <section className="gift-history"><header><h2>선물 내역</h2><span>최근 20건</span></header>{pending==="load" ? <div className="feature-loading">선물 내역을 불러오고 있어요.</div> : overview?.gifts.length ? <div>{overview.gifts.map((gift) => <article key={gift.id}><span className={gift.direction}>{gift.direction==="sent" ? <ArrowUpRight size={19}/> : <ArrowDownLeft size={19}/>}</span><div><strong><StampedName full name={gift.partnerName} stamp={gift.partnerStampEmoji}/></strong><p>{gift.message || (gift.direction==="sent" ? "도토리를 선물했어요." : "도토리를 선물받았어요.")}</p><time dateTime={gift.createdAt}>{formatDate(gift.createdAt)}{gift.direction==="received" && gift.status==="pending" ? " · 수령 대기" : ""}</time></div><b className={`${gift.direction} ${gift.status}`}>{gift.direction==="sent" ? "-" : gift.status==="pending" ? "대기 " : "+"}{gift.amount.toLocaleString()} 🌰</b></article>)}</div> : <div className="gift-history-empty">아직 주고받은 도토리 선물이 없습니다.</div>}</section>
    <AchievementDialog open={Boolean(celebration)} eyebrow="ACORN GIFT" title={celebration?.title || ""} description={celebration?.description || ""} reward={celebration?.reward} confirmLabel="확인" onConfirm={() => setCelebration(null)}/>
    <AchievementDialog open={giftConfirm} eyebrow="ACORN GIFT" title={`${recipient?.nickname || "받는 분"}님에게 선물할까요?`} description={`도토리 ${(giftAmountNumber||0).toLocaleString()}개를 상대방의 선물보따리에 보냅니다.`} reward={`선행 포인트 +${expectedKindnessPoints.toLocaleString()}점`} confirmLabel={pending==="send"?"보내는 중...":"네, 선물할게요"} cancelLabel="아니오" pending={pending==="send"} onConfirm={() => void sendGift()} onCancel={() => setGiftConfirm(false)}/>
  </section>;
}

function formatDate(value:string) { return new Intl.DateTimeFormat("ko-KR",{ month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit" }).format(new Date(value)); }
