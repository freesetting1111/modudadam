"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, LoaderCircle, LogOut, Pencil } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { MyMenuIcon } from "@/components/my-menu-icon";
import { StampedName } from "@/components/stamped-name";

type Profile = {
  nickname: string;
  statusMessage: string;
  avatarUrl: string | null;
  stampEmoji: string | null;
  provider: "kakao" | "naver" | "local";
};

export function MyOverview() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ profile: Profile }>("/api/users/me/profile", { cache: "no-store", signal: controller.signal })
      .then(({ profile: loaded }) => setProfile(loaded))
      .catch((caught) => {
        if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message);
      });
    return () => controller.abort();
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      router.replace("/");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그아웃하지 못했습니다.");
      setLoggingOut(false);
    }
  }

  if (error && !profile) return <div className="profile-state error">{error}</div>;
  if (!profile) return <div className="profile-state"><LoaderCircle className="spin" size={22} /> 내 정보를 불러오는 중입니다.</div>;

  return <div className="my-dashboard">
    <section className="my-account-summary">
      <span className="my-account-avatar"><Image src={profile.avatarUrl || "/brand/modudadam-avatar-clean.png"} alt="" width={64} height={64} unoptimized={Boolean(profile.avatarUrl)} /></span>
      <div><strong><StampedName full name={profile.nickname} stamp={profile.stampEmoji} /></strong><p>{profile.statusMessage || "프로필을 완성하고 나를 소개해 보세요."}</p></div>
      <Link href="/my/profile"><Pencil size={14} /> 편집</Link>
    </section>

    <section className="my-menu-section">
      <h2>커뮤니티</h2>
      <nav className="my-menu-list" aria-label="커뮤니티 메뉴">
        <MenuLink href="/my/activity" icon="community" tone="blue" title="내 커뮤니티 활동" description="작성글, 작성 댓글, 스크랩을 게시판별로 확인해요." />
        <MenuLink href="/my/stamps" icon="stamp" tone="green" title="내 스탬프" description="닉네임 옆에 표시할 대표 스탬프를 선택해요." />
      </nav>
    </section>

    <section className="my-menu-section">
      <h2>계정 및 안내</h2>
      <nav className="my-menu-list" aria-label="계정 및 안내 메뉴">
        <MenuLink href="/my/profile" icon="profile" tone="purple" title="프로필 편집" description="닉네임과 기본 정보를 관리해요." />
        <MenuLink href="/my/policies" icon="policy" tone="peach" title="약관 및 정책" description="서비스 이용약관과 개인정보 처리 내용을 확인해요." />
      </nav>
    </section>

    {error && <div className="form-error" role="alert">{error}</div>}
    <button className="my-logout-button" type="button" onClick={() => void logout()} disabled={loggingOut}><LogOut size={16}/> {loggingOut ? "로그아웃 중..." : "로그아웃"}</button>
    <Link className="my-withdrawal-link" href="/my/withdrawal">회원탈퇴</Link>
  </div>;
}

function MenuLink({ href, icon, tone, title, description }: { href: string; icon: "community" | "profile" | "policy" | "stamp"; tone: string; title: string; description: string }) {
  return <Link className="my-menu-item" href={href}><span className={`my-menu-icon ${tone}`}><MyMenuIcon type={icon}/></span><div><strong>{title}</strong><small>{description}</small></div><ChevronRight size={18}/></Link>;
}
