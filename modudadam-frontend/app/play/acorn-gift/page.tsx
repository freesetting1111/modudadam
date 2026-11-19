import type { Metadata } from "next";
import { AcornGift } from "@/components/acorn-gift";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";

export const metadata:Metadata = { title:"도토리 선물하기",description:"고마운 이웃에게 도토리와 메시지를 선물해 보세요.", ...memberContentMetadata };
export default async function AcornGiftPage() { await requirePlayUser("/play/acorn-gift"); return <AcornGift/>; }
