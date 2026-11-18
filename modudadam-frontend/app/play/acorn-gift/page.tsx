import type { Metadata } from "next";
import { AcornGift } from "@/components/acorn-gift";

export const metadata:Metadata = { title:"도토리 선물하기",description:"고마운 이웃에게 도토리와 메시지를 선물해 보세요." };
export default function AcornGiftPage() { return <AcornGift/>; }
