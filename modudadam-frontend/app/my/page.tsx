import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getServerSessionUser } from "@/lib/auth";

export const metadata = { title: "마이페이지" };

export default async function MyPage() {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=/my");

  return <section className="my-page">
    <header className="my-page-heading"><small>MY PROFILE</small><h1>마이페이지</h1><p>모두다담에서 사용할 내 정보를 확인하고 수정해요.</p></header>
    <ProfileForm />
  </section>;
}
