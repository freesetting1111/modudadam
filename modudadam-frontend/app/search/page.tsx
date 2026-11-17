import Link from "next/link";
import { SearchResults } from "@/components/search-results";
import { categories } from "@/lib/categories";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = String((await searchParams).q || "").trim().slice(0, 80);
  return <section className="content-page search-page">
    <h1>통합검색</h1>
    <SearchResults key={query} initialQuery={query} />
    {!query && <><h2>카테고리로 찾기</h2><div className="search-categories">{categories.map((category) => { const Icon = category.icon; return <Link key={category.code} href={`/category/${category.code}`}><span className={`search-category-icon category-${category.code}`}><Icon size={19} /></span>{category.name}</Link>; })}</div></>}
  </section>;
}
