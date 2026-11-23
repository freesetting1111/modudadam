import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { getServerSessionUser } from "@/lib/auth";

export const metadata = { title: "프로필 편집" };

export default async function ProfileEditPage() {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=/my/profile");
  return <section className="my-page my-subpage">
    <header className="my-subpage-heading"><Link href="/my" aria-label="마이페이지로 돌아가기"><ChevronLeft size={22} /></Link><div><h1>프로필 편집</h1><p>닉네임과 기본 정보</p></div></header>
    <ProfileForm initialEditing standalone />
  </section>;
}
