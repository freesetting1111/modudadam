import { TasteLab } from "@/components/dadam-features";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("taste");
export default async function TastePage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.taste}/>;return <TasteLab kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""}/>; }
