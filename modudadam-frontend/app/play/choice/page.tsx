import type { Metadata } from "next";
import { TodayChoice } from "@/components/dadam-features";
export const metadata: Metadata = { title: "오늘의 선택", description: "매일 새로운 두 가지 선택에 참여해 보세요." };
export default function ChoicePage() { return <TodayChoice/>; }
