import { DadamMailbox } from "@/components/dadam-features";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata } from "@/lib/public-play-features";
export const metadata=publicPlayFeatureMetadata("mailbox");
export default async function MailboxPage() { return <DadamMailbox authenticated={Boolean(await getServerSessionUser())}/>; }
