import { TreasureMap } from "@/components/dadam-features";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("treasures");
export default async function TreasuresPage() { return <TreasureMap authenticated={Boolean(await getServerSessionUser())} kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""}/>; }
