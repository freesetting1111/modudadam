"use client";

import { ArrowDownLeft, ArrowUpRight, Check, HandCoins, Search, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { StampedName } from "@/components/stamped-name";

type GiftHistory = { id:string;direction:"sent"|"received";amount:number;message:string|null;partnerName:string;partnerStampEmoji:string|null;createdAt:string };
type GiftOverview = { balance:number;gifts:GiftHistory[] };
type Recipient = { nickname:string;stampEmoji:string|null };

export function AcornGift() {
  const router=useRouter();
  const [overview,setOverview]=useState<GiftOverview | null>(null);
  const [nickname,setNickname]=useState("");
  const [recipient,setRecipient]=useState<Recipient | null>(null);
  const [amount,setAmount]=useState("1");
  const [message,setMessage]=useState("");
  const [pending,setPending]=useState<"load"|"search"|"send"|"">("load");
  const [notice,setNotice]=useState("");
  const requestRef=useRef<{ payload:string;key:string } | null>(null);

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
    const giftAmount=Number(amount);
    if (!recipient || recipient.nickname.toLowerCase()!==nickname.trim().toLowerCase()) { setNotice("받는 분을 다시 확인해 주세요.");return; }
    if (!Number.isInteger(giftAmount) || giftAmount<1) { setNotice("선물할 도토리 개수를 확인해 주세요.");return; }
    if (!window.confirm(`${recipient.nickname}님에게 도토리 ${giftAmount.toLocaleString()}개를 선물할까요?`)) return;
    setPending("send");setNotice("");
    try {
      const payload=JSON.stringify({ nickname:recipient.nickname,amount:giftAmount,message });
      if (requestRef.current?.payload!==payload) requestRef.current={ payload,key:crypto.randomUUID() };
      const result=await apiRequest<{ balance:number;recipientName:string }>("/api/features/acorn-gifts",{ method:"POST",body:JSON.stringify({ nickname:recipient.nickname,amount:giftAmount,message,requestKey:requestRef.current.key }) });
      setNotice(`${result.recipientName}님에게 도토리 ${giftAmount.toLocaleString()}개를 선물했어요.`);
      requestRef.current=null;setNickname("");setRecipient(null);setAmount("1");setMessage("");await load();
    } catch(error) { handleError(error,"도토리 선물을 보내지 못했습니다."); } finally { setPending(""); }
  }

  return <section className="dadam-feature-page acorn-gift-page">
    <header className="dadam-feature-hero"><span><HandCoins size={26}/></span><div><small>ACORN GIFT</small><h1>도토리 선물하기</h1><p>고마운 이웃에게 따뜻한 메시지와 함께 도토리를 보내보세요.</p></div></header>
    <article className="gift-wallet"><span>🌰</span><div><small>보유 도토리</small><strong>{overview?.balance.toLocaleString() ?? "-"}개</strong></div></article>
    <div className="acorn-gift-form">
      <label><span>받는 분 닉네임</span><div><input value={nickname} maxLength={60} placeholder="닉네임을 정확히 입력해 주세요" onChange={(event) => { setNickname(event.target.value);setRecipient(null); }} onKeyDown={(event) => { if(event.key==="Enter") void findRecipient(); }}/><button type="button" disabled={pending==="search"} onClick={() => void findRecipient()}><Search size={17}/>{pending==="search" ? "확인 중" : "확인"}</button></div></label>
      {recipient && <div className="gift-recipient"><Check size={17}/><span><StampedName full name={recipient.nickname} stamp={recipient.stampEmoji}/></span><small>선물 받을 사용자</small></div>}
      <label><span>선물할 도토리</span><div className="gift-amount"><input type="number" min="1" max={Math.max(1,overview?.balance || 1)} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)}/><b>개</b></div></label>
      <div className="gift-quick-amounts">{[1,5,10,30].map((value) => <button type="button" key={value} disabled={value>(overview?.balance || 0)} onClick={() => setAmount(String(value))}>+{value}</button>)}</div>
      <label><span>함께 보낼 메시지 <small>{message.length}/80</small></span><textarea rows={3} maxLength={80} value={message} placeholder="짧은 마음을 남겨보세요. (선택)" onChange={(event) => setMessage(event.target.value)}/></label>
      <button className="gift-send-button" type="button" disabled={!recipient || pending==="send" || Number(amount)>(overview?.balance || 0)} onClick={() => void sendGift()}><Send size={18}/>{pending==="send" ? "선물 보내는 중..." : "도토리 선물하기"}</button>
    </div>
    {notice && <p className="reward-notice">{notice}</p>}
    <section className="gift-history"><header><h2>선물 내역</h2><span>최근 20건</span></header>{pending==="load" ? <div className="feature-loading">선물 내역을 불러오고 있어요.</div> : overview?.gifts.length ? <div>{overview.gifts.map((gift) => <article key={gift.id}><span className={gift.direction}>{gift.direction==="sent" ? <ArrowUpRight size={19}/> : <ArrowDownLeft size={19}/>}</span><div><strong><StampedName full name={gift.partnerName} stamp={gift.partnerStampEmoji}/></strong><p>{gift.message || (gift.direction==="sent" ? "도토리를 선물했어요." : "도토리를 선물받았어요.")}</p><time dateTime={gift.createdAt}>{formatDate(gift.createdAt)}</time></div><b className={gift.direction}>{gift.direction==="sent" ? "-" : "+"}{gift.amount.toLocaleString()} 🌰</b></article>)}</div> : <div className="gift-history-empty">아직 주고받은 도토리 선물이 없습니다.</div>}</section>
  </section>;
}

function formatDate(value:string) { return new Intl.DateTimeFormat("ko-KR",{ month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit" }).format(new Date(value)); }
