import { DadamTimeCapsule } from "@/components/dadam-time-detective";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";

export const metadata=publicPlayFeatureMetadata("time-capsule");
export default async function TimeCapsulePage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures["time-capsule"]}/>;return <DadamTimeCapsule/>; }
