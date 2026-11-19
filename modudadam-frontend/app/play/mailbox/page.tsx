import type { Metadata } from "next";
import { DadamMailbox } from "@/components/dadam-features";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";
export const metadata: Metadata = { title: "다담 우체통", description: "고정된 익명 ID로 마음과 답장을 나눠보세요.", ...memberContentMetadata };
export default async function MailboxPage() { await requirePlayUser("/play/mailbox"); return <DadamMailbox/>; }
