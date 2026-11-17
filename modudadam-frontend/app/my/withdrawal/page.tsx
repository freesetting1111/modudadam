import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { WithdrawalForm } from "@/components/withdrawal-form";
import { getServerSessionUser } from "@/lib/auth";

export const metadata = { title: "회원탈퇴" };

export default async function WithdrawalPage() {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=/my/withdrawal");
  return <section className="my-page my-subpage withdrawal-page">
    <header className="my-subpage-heading"><Link href="/my" aria-label="마이페이지로 돌아가기"><ChevronLeft size={22}/></Link><div><h1>회원탈퇴</h1><p>신청하기 전에 안내 사항을 꼭 확인해 주세요.</p></div></header>
    <WithdrawalForm />
  </section>;
}
