import type { Metadata } from "next";
import { TasteLab } from "@/components/dadam-features";
export const metadata: Metadata = { title: "취향 발견실", description: "짧은 선택으로 나의 생활 취향을 발견해 보세요." };
export default function TastePage() { return <TasteLab/>; }
