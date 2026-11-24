import { DadamTimeCapsule } from "@/components/dadam-time-detective";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata } from "@/lib/public-play-features";

export const metadata=publicPlayFeatureMetadata("time-capsule");
export default async function TimeCapsulePage() { return <DadamTimeCapsule authenticated={Boolean(await getServerSessionUser())}/>; }
