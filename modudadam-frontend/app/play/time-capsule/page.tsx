import type { Metadata } from "next";
import { DadamTimeCapsule } from "@/components/dadam-time-detective";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";

export const metadata:Metadata={ title:"다담 타임캡슐",description:"오늘의 마음을 봉인하고 미래의 나에게 전해보세요.",...memberContentMetadata };
export default async function TimeCapsulePage() { await requirePlayUser("/play/time-capsule");return <DadamTimeCapsule/>; }
