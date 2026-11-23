import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { WriteForm } from "@/components/write-form";
import { getServerSessionUser } from "@/lib/auth";
import { findBoard } from "@/lib/categories";

export default async function CategoryWritePage({ params }: { params: Promise<{ code: string }> }) {
  const category = findBoard((await params).code);
  if (!category) notFound();
  if(category.code==="bounty") redirect("/play/bounties/write");
  const user=await getServerSessionUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/category/${category.code}/write`)}`);
  if (category.code==="notice" && user.email?.trim().toLowerCase()!=="freesetting@naver.com") redirect(`/category/${category.code}`);
  const Icon = category.icon;

  return <section className="content-page write-page compose-page">
    <header className="compose-header">
      <Link href={`/category/${category.code}`} aria-label={`${category.name} 게시판으로 돌아가기`}><ChevronLeft size={24} /></Link>
      <span className={`compose-category-icon category-${category.code}`}><Icon size={23} strokeWidth={1.9} /></span>
      <div><small>{category.name} 게시판</small><h1>새 글 작성</h1></div>
    </header>
    <WriteForm initialCategory={category.code} initialCategoryName={category.name} />
  </section>;
}
