import type { Metadata } from "next";
import { RandomJourney } from "@/components/dadam-features";
export const metadata: Metadata = { title: "랜덤 이야기 여행", description: "모두다담의 숨은 이야기를 무작위로 만나보세요." };
export default function RandomPage() { return <RandomJourney/>; }
