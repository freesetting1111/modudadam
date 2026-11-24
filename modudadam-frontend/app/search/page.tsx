import type { Metadata } from "next";
import { HomeSearch } from "@/components/home-search";

export const metadata:Metadata={
  title:"통합검색",description:"모두다담 게시글과 생활 정보를 검색합니다.",
  alternates:{ canonical:"/search" },robots:{ index:false,follow:true },
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = String((await searchParams).q || "").trim().slice(0, 80);
  return <HomeSearch mode="page" initialQuery={query} />;
}
