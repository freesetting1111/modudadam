import { DadamDetectiveRoom } from "@/components/dadam-time-detective";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";

export const metadata=publicPlayFeatureMetadata("detective");
export default async function DetectivePage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.detective}/>;return <DadamDetectiveRoom/>; }
