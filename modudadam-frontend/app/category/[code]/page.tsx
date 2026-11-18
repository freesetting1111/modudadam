import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { BoardList, type BoardFeedPage } from "@/components/board-list";
import { categories, findBoard, specialBoards } from "@/lib/categories";
import { getServerSessionUser } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/server-config";

export function generateStaticParams() { return [...specialBoards,...categories].map(({ code }) => ({ code })); }
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const category = findBoard((await params).code);
  if (!category) return { robots: { index: false, follow: false } };
  return { title: category.name, description: category.description, alternates: { canonical: `/category/${category.code}` }, openGraph: { title: category.name, description: category.description, url: `/category/${category.code}` } };
}
export default async function CategoryPage({ params }: { params: Promise<{ code: string }> }) {
  const category = findBoard((await params).code); if (!category) notFound();
  const cookieHeader=(await cookies()).toString();
  const [user, initialPage] = await Promise.all([
    getServerSessionUser(),
    getInitialPage(category.code,cookieHeader),
  ]);
  const Icon = category.icon;
  const canWrite=Boolean(user) && (category.code!=="notice" || user?.email?.trim().toLowerCase()==="freesetting@naver.com");
  return <section className="content-page board-page"><div className="category-hero"><span className={`category-icon category-icon-large category-${category.code}`}><Icon size={27} strokeWidth={1.8} /></span><div><small>{category.code==="notice" ? "모두다담 안내" : "커뮤니티"}</small><h1>{category.name}</h1><p>{category.description}</p></div></div><BoardList categoryCode={category.code} categoryName={category.name} canWrite={canWrite} initialPage={initialPage} /></section>;
}

async function getInitialPage(categoryCode: string,cookieHeader:string): Promise<BoardFeedPage | undefined> {
  try {
    const params = new URLSearchParams({ category: categoryCode, sort: "latest", limit: "20" });
    const response = await fetch(`${API_SERVER_URL}/api/posts?${params}`, { cache: "no-store",headers:cookieHeader ? { cookie:cookieHeader } : undefined });
    if (!response.ok) return undefined;
    const body = await response.json() as { success?: boolean; data?: BoardFeedPage };
    return body.success ? body.data : undefined;
  } catch {
    return undefined;
  }
}
