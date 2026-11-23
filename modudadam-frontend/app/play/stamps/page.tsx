import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { DadamStampShop } from "@/components/dadam-rewards";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";

export const metadata: Metadata = { title:"도토리 상점",description:"도토리로 스탬프를 구매하거나 악행 포인트로 전환해 보세요.", ...memberContentMetadata };

export default async function StampShopPage() {
  await requirePlayUser("/play/stamps");
  return <section className="stamp-store-page">
    <header className="reward-hero stamp-store-hero"><span><Gift size={27}/></span><div><small>도토리 상점</small><h1>도토리 상점</h1><p>스탬프 구매와 포인트 전환</p></div></header>
    <DadamStampShop/>
  </section>;
}
