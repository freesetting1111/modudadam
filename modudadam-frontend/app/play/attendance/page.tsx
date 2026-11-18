import type { Metadata } from "next";
import { DadamAttendance } from "@/components/dadam-rewards";
export const metadata:Metadata = { title:"다담 출석부",description:"매일 출석 스탬프를 찍고 도토리를 모아보세요." };
export default function AttendancePage() { return <DadamAttendance/>; }
