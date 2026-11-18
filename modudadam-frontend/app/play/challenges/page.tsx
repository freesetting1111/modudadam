import type { Metadata } from "next";
import { DadamChallenges } from "@/components/dadam-rewards";
export const metadata:Metadata = { title:"다담 챌린지",description:"작은 생활 습관을 이웃과 함께 이어가 보세요." };
export default function ChallengesPage() { return <DadamChallenges/>; }
