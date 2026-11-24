import { DadamMailbox } from "@/components/dadam-features";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("mailbox");
export default async function MailboxPage() { if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures.mailbox}/>;return <DadamMailbox/>; }
