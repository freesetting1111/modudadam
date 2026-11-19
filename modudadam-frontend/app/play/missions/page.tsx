import type { Metadata } from "next";
import { DadamMissions } from "@/components/dadam-rewards";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";
export const metadata:Metadata = { title:"다담 미션",description:"매일 새로운 생활 퀴즈를 풀고 도토리를 모아보세요.", ...memberContentMetadata };
export default async function MissionsPage() { await requirePlayUser("/play/missions"); return <DadamMissions/>; }
