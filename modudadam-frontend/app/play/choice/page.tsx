import { TodayChoice } from "@/components/dadam-features";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("choice");
export default async function ChoicePage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.choice}/>;return <TodayChoice/>; }
