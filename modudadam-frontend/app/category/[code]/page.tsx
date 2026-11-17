import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardList, type BoardFeedPage } from "@/components/board-list";
import { categories, findCategory } from "@/lib/categories";
import { getServerSessionUser } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/server-config";

export function generateStaticParams() { return categories.map(({ code }) => ({ code })); }
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const category = findCategory((await params).code);
  if (!category) return { robots: { index: false, follow: false } };
  return { title: category.name, description: category.description, alternates: { canonical: `/category/${category.code}` }, openGraph: { title: category.name, description: category.description, url: `/category/${category.code}` } };
}
export default async function CategoryPage({ params }: { params: Promise<{ code: string }> }) {
  const category = findCategory((await params).code); if (!category) notFound();
  const [user, initialPage] = await Promise.all([
    getServerSessionUser(),
    getInitialPage(category.code),
  ]);
  const Icon = category.icon;
  return <section className="content-page board-page"><div className="category-hero"><span className={`category-icon category-icon-large category-${category.code}`}><Icon size={27} strokeWidth={1.8} /></span><div><small>커뮤니티</small><h1>{category.name}</h1><p>{category.description}</p></div></div><BoardList categoryCode={category.code} categoryName={category.name} authenticated={Boolean(user)} initialPage={initialPage} /></section>;
}

async function getInitialPage(categoryCode: string): Promise<BoardFeedPage | undefined> {
  try {
    const params = new URLSearchParams({ category: categoryCode, sort: "latest", limit: "20" });
    const response = await fetch(`${API_SERVER_URL}/api/posts?${params}`, { cache: "no-store" });
    if (!response.ok) return undefined;
    const body = await response.json() as { success?: boolean; data?: BoardFeedPage };
    return body.success ? body.data : undefined;
  } catch {
    return undefined;
  }
}
