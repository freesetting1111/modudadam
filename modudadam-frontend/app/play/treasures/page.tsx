import type { Metadata } from "next";
import { TreasureMap } from "@/components/dadam-features";
import { memberContentMetadata, requirePlayUser } from "@/lib/play-auth";
export const metadata: Metadata = { title: "동네 보물지도", description: "이웃이 직접 발견한 생활 속 좋은 장소를 만나보세요.", ...memberContentMetadata };
export default async function TreasuresPage() { await requirePlayUser("/play/treasures"); return <TreasureMap kakaoJavascriptKey={process.env.KAKAO_JAVASCRIPT_KEY || ""}/>; }
