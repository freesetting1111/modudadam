import { HomeSearch } from "@/components/home-search";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = String((await searchParams).q || "").trim().slice(0, 80);
  return <HomeSearch mode="page" initialQuery={query} />;
}
