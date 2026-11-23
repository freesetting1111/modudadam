import { redirect } from "next/navigation";
import { MyOverview } from "@/components/my-overview";
import { getServerSessionUser } from "@/lib/auth";

export const metadata = { title: "마이페이지" };

export default async function MyPage() {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=/my");

  return <section className="my-page my-home-page">
    <header className="my-page-heading"><h1>마이페이지</h1><p>내 정보와 활동</p></header>
    <MyOverview />
  </section>;
}
