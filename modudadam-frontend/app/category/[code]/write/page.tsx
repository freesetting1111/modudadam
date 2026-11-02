import { notFound, redirect } from "next/navigation";
import { WriteForm } from "@/components/write-form";
import { getServerSessionUser } from "@/lib/auth";
import { findCategory } from "@/lib/categories";

export default async function CategoryWritePage({ params }: { params: Promise<{ code: string }> }) {
  const category = findCategory((await params).code);
  if (!category) notFound();
  if (!await getServerSessionUser()) redirect(`/login?returnTo=${encodeURIComponent(`/category/${category.code}/write`)}`);

  return <section className="content-page write-page">
    <h1>{category.name} 글쓰기</h1>
    <p className="page-intro">{category.name} 게시판에 경험과 유용한 정보를 남겨주세요.</p>
    <WriteForm initialCategory={category.code} initialCategoryName={category.name} />
  </section>;
}
