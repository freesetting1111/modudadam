import { DadamAttendance } from "@/components/dadam-rewards";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("attendance");
export default async function AttendancePage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.attendance}/>;return <DadamAttendance/>; }
