import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { TermsContent } from "@/components/signup-form";
import { getServerSessionUser } from "@/lib/auth";

export const metadata = { title: "약관 및 정책" };

export default async function PoliciesPage() {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=/my/policies");
  return <section className="my-page my-subpage">
    <header className="my-subpage-heading"><Link href="/my" aria-label="마이페이지로 돌아가기"><ChevronLeft size={22} /></Link><div><h1>약관 및 정책</h1><p>모두다담 서비스의 이용 기준과 개인정보 처리 내용을 확인해요.</p></div></header>
    <section className="my-policy-card"><TermsContent /></section>
  </section>;
}
