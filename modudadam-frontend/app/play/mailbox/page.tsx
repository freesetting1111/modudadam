import type { Metadata } from "next";
import { DadamMailbox } from "@/components/dadam-features";
export const metadata: Metadata = { title: "다담 우체통", description: "고정된 익명 ID로 마음과 답장을 나눠보세요." };
export default function MailboxPage() { return <DadamMailbox/>; }
