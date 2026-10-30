"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleHelp, Home, LogIn, Menu, Search, SquarePen, X } from "lucide-react";
import { categories } from "@/lib/categories";

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

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
          {pathname !== "/login" && <div className="drawer-login"><Link href="/login" onClick={closeMenu}>로그인하세요 <b>›</b></Link></div>}
          <h2>카테고리</h2>
          <div className="drawer-grid">{categories.map((category) => {
            const Icon = category.icon;
            return <Link href={`/category/${category.code}`} key={category.code} onClick={closeMenu}><span className={`drawer-icon category-${category.code}`}><Icon size={24} strokeWidth={1.9} /></span>{category.short}</Link>;
          })}</div>
          <h2>서비스 바로가기</h2>
          <div className="service-links"><Link href="/" onClick={closeMenu}><Home /> 홈</Link><Link href="/search" onClick={closeMenu}><Search /> 통합검색</Link><Link href="/write" onClick={closeMenu}><SquarePen /> 글쓰기</Link><Link href="/about" onClick={closeMenu}><CircleHelp /> 모두다담 소개</Link></div>
        </div>
      </div>
      <Link href="/" className="brand"><span className="brand-mark"><Image src="/brand/modudadam-squirrel.png" alt="" width={38} height={38} priority /></span><strong>모두다담</strong></Link>
      {pathname === "/login" ? <span aria-hidden="true" /> : <Link href="/login" className="login-link"><LogIn size={14} /> 로그인</Link>}
    </header>
  );
}
