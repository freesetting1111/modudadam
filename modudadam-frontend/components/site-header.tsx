"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, CircleHelp, CircleUserRound, Home, LogIn, LogOut, Menu, Search, X } from "lucide-react";
import { categories } from "@/lib/categories";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";

export function SiteHeader({ initialUser }: { initialUser: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ user: SessionUser | null }>("/api/auth/me", {
      cache: "no-store",
      signal: controller.signal,
    }).then((data) => setUser(data.user)).catch((error) => {
      if (error instanceof Error && error.name !== "AbortError") setUser(null);
    });
    return () => controller.abort();
  }, [pathname]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
      setUser(null);
      closeMenu();
      router.replace("/");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="site-header">
      <div className="menu-drawer">
        <button
          type="button"
          className="menu-button"
          aria-label={isMenuOpen ? "전체 메뉴 닫기" : "전체 메뉴 열기"}
          aria-expanded={isMenuOpen}
          aria-controls="site-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X size={25} strokeWidth={2} /> : <Menu size={26} strokeWidth={2} />}
        </button>
        <div id="site-menu" className="drawer-panel" data-open={isMenuOpen || undefined} aria-hidden={!isMenuOpen}>
          {pathname !== "/login" && (user ? <div className="drawer-account">
            <span className="drawer-account-avatar"><Image src="/brand/modudadam-squirrel.png" alt="" width={44} height={44} /></span>
            <span className="drawer-account-copy"><small>로그인 중</small><strong>{user.nickname}</strong></span>
            <button type="button" className="drawer-logout" onClick={logout} disabled={loggingOut}><LogOut size={16} /> {loggingOut ? "처리 중" : "로그아웃"}</button>
          </div> : <Link href="/login" className="drawer-account drawer-account-guest" onClick={closeMenu}>
            <span className="drawer-account-avatar"><CircleUserRound size={25} /></span>
            <span className="drawer-account-copy"><small>모두다담에 오신 걸 환영해요</small><strong>로그인</strong></span>
            <ChevronRight size={19} />
          </Link>)}
          <h2>카테고리</h2>
          <div className="drawer-grid">{categories.map((category) => {
            const Icon = category.icon;
            return <Link href={`/category/${category.code}`} key={category.code} onClick={closeMenu}><span className={`drawer-icon category-${category.code}`}><Icon size={24} strokeWidth={1.9} /></span>{category.short}</Link>;
          })}</div>
          <h2>서비스 바로가기</h2>
          <div className="service-links"><Link href="/" onClick={closeMenu}><Home /> 홈</Link><Link href="/search" onClick={closeMenu}><Search /> 통합검색</Link><Link href="/about" onClick={closeMenu}><CircleHelp /> 모두다담 소개</Link></div>
        </div>
      </div>
      <Link href="/" className="brand"><span className="brand-mark"><Image src="/brand/modudadam-squirrel.png" alt="" width={38} height={38} priority /></span><strong>모두다담</strong></Link>
      {pathname === "/login" ? <span aria-hidden="true" /> : user ? <span className="header-account-spacer" aria-hidden="true" /> : <Link href="/login" className="login-link"><LogIn size={14} /> 로그인</Link>}
    </header>
  );
}
