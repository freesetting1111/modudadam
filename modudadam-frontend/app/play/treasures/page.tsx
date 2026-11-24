import { TreasureMap } from "@/components/dadam-features";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("treasures");
export default async function TreasuresPage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.treasures}/>;return <TreasureMap kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""}/>; }
