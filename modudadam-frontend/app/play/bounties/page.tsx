import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, PenLine } from "lucide-react";
import { BountyQuestions } from "@/components/bounty-questions";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";

export const metadata:Metadata={ title:"현상금 질문",description:"도토리를 걸고 경험 있는 이웃의 답변을 요청해 보세요.",...memberContentMetadata };

export default async function BountyQuestionsPage() {
  await requirePlayUser("/play/bounties");
  return <section className="content-page bounty-service-page">
    <header className="bounty-service-hero"><span><HandCoins size={31}/></span><div><small>MODUDADAM BOUNTY</small><h1>현상금 질문</h1><p>검색으로 해결하기 어려운 생활 질문을 올리고, 채택한 답변에 도토리로 보답하세요.</p></div><Link href="/play/bounties/write"><PenLine size={17}/>질문 작성</Link></header>
    <BountyQuestions/>
  </section>;
}
