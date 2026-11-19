import type { Metadata } from "next";
import { TodayChoice } from "@/components/dadam-features";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";
export const metadata: Metadata = { title: "오늘의 극한 밸런스", description: "매일 새롭게 열리는 극한의 양자택일에 참여해 보세요.", ...memberContentMetadata };
export default async function ChoicePage() { await requirePlayUser("/play/choice"); return <TodayChoice/>; }
