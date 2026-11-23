import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, PenLine } from "lucide-react";
import { BountyQuestions } from "@/components/bounty-questions";

export const metadata:Metadata={ title:"현상금 질문",description:"생활 속 궁금한 점에 도토리 현상금을 걸고 경험 있는 이웃의 답변을 받는 모두다담 질문 게시판입니다.",alternates:{canonical:"/play/bounties"},robots:{index:true,follow:true},openGraph:{type:"website",title:"현상금 질문 | 모두다담",description:"도토리 현상금으로 필요한 답변을 빠르게 요청하세요.",url:"/play/bounties",siteName:"모두다담",locale:"ko_KR"} };

export default function BountyQuestionsPage() {
  return <section className="content-page bounty-service-page">
    <header className="bounty-service-hero"><span><HandCoins size={31}/></span><div><h1>현상금 질문</h1><p>질문을 올리고 채택한 답변에 도토리를 지급합니다.</p></div><Link href="/play/bounties/write"><PenLine size={17}/>질문 작성</Link></header>
    <BountyQuestions/>
  </section>;
}
