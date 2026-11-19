import type { Metadata } from "next";
import { DadamAttendance } from "@/components/dadam-rewards";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";
export const metadata:Metadata = { title:"다담 출석부",description:"매일 출석 스탬프를 찍고 도토리를 모아보세요.", ...memberContentMetadata };
export default async function AttendancePage() { await requirePlayUser("/play/attendance"); return <DadamAttendance/>; }
