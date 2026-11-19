import type { Metadata } from "next";
import { TodayChoice } from "@/components/dadam-features";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";
export const metadata: Metadata = { title: "오늘의 선택", description: "매일 새로운 두 가지 선택에 참여해 보세요.", ...memberContentMetadata };
export default async function ChoicePage() { await requirePlayUser("/play/choice"); return <TodayChoice/>; }
