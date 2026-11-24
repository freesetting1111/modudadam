import { DadamMissions } from "@/components/dadam-rewards";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("missions");
export default async function MissionsPage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.missions}/>;return <DadamMissions/>; }
