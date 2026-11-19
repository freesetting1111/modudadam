import type { Metadata } from "next";
import { TasteLab } from "@/components/dadam-features";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";
export const metadata: Metadata = { title: "취향 발견실", description: "짧은 선택으로 나의 생활 취향을 발견해 보세요.", ...memberContentMetadata };
export default async function TastePage() { await requirePlayUser("/play/taste"); return <TasteLab kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""}/>; }
