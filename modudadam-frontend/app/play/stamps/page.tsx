import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { DadamStampShop } from "@/components/dadam-rewards";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";

export const metadata: Metadata = { title:"도토리 스탬프 상점",description:"도토리로 스탬프를 모으고 대표 스탬프를 선택해 보세요.", ...memberContentMetadata };

export default async function StampShopPage() {
  await requirePlayUser("/play/stamps");
  return <section className="stamp-store-page">
    <header className="reward-hero stamp-store-hero"><span><Gift size={27}/></span><div><small>ACORN STAMP SHOP</small><h1>도토리 스탬프 상점</h1><p>모은 도토리로 스탬프를 해금하고 대표 스탬프를 꾸며보세요.</p></div></header>
    <DadamStampShop/>
  </section>;
}
