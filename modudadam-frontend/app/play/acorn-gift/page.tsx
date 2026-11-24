import type { Metadata } from "next";
import { AcornGift } from "@/components/acorn-gift";
import { PublicPlayFeatureLanding } from "@/components/public-play-feature-landing";
import { getServerSessionUser } from "@/lib/auth";
import { publicPlayFeatureMetadata,publicPlayFeatures } from "@/lib/public-play-features";

export const metadata:Metadata=publicPlayFeatureMetadata("acorn-gift");
export default async function AcornGiftPage() {
  if(!await getServerSessionUser()) return <PublicPlayFeatureLanding feature={publicPlayFeatures["acorn-gift"]}/>;
  return <AcornGift/>;
}
