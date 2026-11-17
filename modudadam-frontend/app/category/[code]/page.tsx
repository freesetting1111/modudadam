import { notFound } from "next/navigation";
import { BoardList } from "@/components/board-list";
import { categories, findCategory } from "@/lib/categories";
import { getServerSessionUser } from "@/lib/auth";

export function generateStaticParams() { return categories.map(({ code }) => ({ code })); }
export default async function CategoryPage({ params }: { params: Promise<{ code: string }> }) {
  const category = findCategory((await params).code); if (!category) notFound();
  const user = await getServerSessionUser();
  const Icon = category.icon;
  return <section className="content-page board-page"><div className="category-hero"><span className={`category-icon category-icon-large category-${category.code}`}><Icon size={27} strokeWidth={1.8} /></span><div><small>커뮤니티</small><h1>{category.name}</h1><p>{category.description}</p></div></div><BoardList categoryCode={category.code} categoryName={category.name} authenticated={Boolean(user)} /></section>;
}
