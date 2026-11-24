import { Gift } from "lucide-react";
import { DadamStampShop } from "@/components/dadam-rewards";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";

export const metadata=publicPlayFeatureMetadata("stamps");

export default async function StampShopPage() {
  if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.stamps}/>;
  return <section className="stamp-store-page">
    <header className="reward-hero stamp-store-hero"><span><Gift size={27}/></span><div><small>도토리 상점</small><h1>도토리 상점</h1><p>스탬프 구매와 포인트 전환</p></div></header>
    <DadamStampShop/>
  </section>;
}
