import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, HandCoins } from "lucide-react";
import { WriteForm } from "@/components/write-form";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";

export const metadata:Metadata={ title:"현상금 질문 작성",description:"도토리 현상금을 걸고 이웃에게 도움을 요청합니다.",...memberContentMetadata };

export default async function BountyQuestionWritePage() {
  await requirePlayUser("/play/bounties/write");
  return <section className="content-page write-page compose-page bounty-compose-page">
    <header className="compose-header bounty-compose-header">
      <Link href="/play/bounties" aria-label="현상금 질문 목록으로 돌아가기"><ChevronLeft size={24}/></Link>
      <span className="compose-category-icon"><HandCoins size={23}/></span>
      <div><small>현상금 질문</small><h1>질문 작성</h1></div>
    </header>
    <WriteForm initialCategory="bounty" initialCategoryName="현상금 질문" mode="bounty"/>
  </section>;
}
