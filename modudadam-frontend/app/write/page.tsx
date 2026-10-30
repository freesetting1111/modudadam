import { WriteForm } from "@/components/write-form";
import { findCategory } from "@/lib/categories";

export default async function WritePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const categoryCode = (await searchParams).category;
  const initialCategory = categoryCode && findCategory(categoryCode) ? categoryCode : undefined;
  return <section className="content-page"><h1>이야기 작성</h1><p className="page-intro">경험과 유용한 정보를 알맞은 게시판에 남겨주세요.</p><WriteForm initialCategory={initialCategory} /></section>;
}
