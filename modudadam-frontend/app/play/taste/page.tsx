import { TasteLab } from "@/components/dadam-features";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("taste");
export default async function TastePage() { return <TasteLab authenticated={Boolean(await getServerSessionUser())} kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""}/>; }
