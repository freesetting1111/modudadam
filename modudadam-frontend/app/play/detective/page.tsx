import type { Metadata } from "next";
import { DadamDetectiveRoom } from "@/components/dadam-time-detective";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";

export const metadata:Metadata={ title:"다담 추리방",description:"열 명의 용의자와 세 가지 단서 속에서 오늘의 사건을 해결해 보세요.",...memberContentMetadata };
export default async function DetectivePage() { await requirePlayUser("/play/detective");return <DadamDetectiveRoom/>; }
