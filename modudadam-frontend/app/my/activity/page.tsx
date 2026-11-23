import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CommunityActivity } from "@/components/community-activity";
import { getServerSessionUser } from "@/lib/auth";

export const metadata = { title: "내 커뮤니티 활동" };

export default async function MyActivityPage() {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=/my/activity");
  return <section className="my-page my-subpage">
    <header className="my-subpage-heading"><Link href="/my" aria-label="마이페이지로 돌아가기"><ChevronLeft size={22} /></Link><div><h1>내 커뮤니티 활동</h1><p>작성글 · 댓글 · 스크랩</p></div></header>
    <CommunityActivity />
  </section>;
}
