import type { Metadata } from "next";
import { DadamChallenges } from "@/components/dadam-challenges";
import { getServerSessionUser } from "@/lib/auth";

export const metadata:Metadata={
  title:"다담 챌린지",description:"생활 습관 챌린지를 둘러보고 매일 실천한 내용을 기록해 보세요.",
  alternates:{ canonical:"/play/challenges" },robots:{ index:true,follow:true },
};

export default async function ChallengesPage() { return <DadamChallenges authenticated={Boolean(await getServerSessionUser())}/>; }
