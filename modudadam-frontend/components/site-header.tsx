"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck2, CalendarHeart, ChevronRight, CircleUserRound, Compass, Flag, Gift, HandCoins, Home, Hourglass, LogOut, Mail, MapPin, Menu, Search, ShieldQuestion, Sparkles, Trophy, UserRound, Vote, X } from "lucide-react";
import { CategoryGrid } from "@/components/category-grid";
import { specialBoards } from "@/lib/categories";
import { apiRequest } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { StampedName } from "@/components/stamped-name";

export function SiteHeader({ initialUser }: { initialUser: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [loggingOut, setLoggingOut] = useState(false);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const canViewVisitors = user?.email?.trim().toLowerCase() === "freesetting@naver.com";

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
    const updateNickname = (event: Event) => {
      const detail = (event as CustomEvent<{ nickname?: string; stampEmoji?: string | null }>).detail;
      setUser((current) => current ? { ...current, ...(detail?.nickname ? { nickname: detail.nickname } : {}), ...(detail && "stampEmoji" in detail ? { stampEmoji: detail.stampEmoji ?? null } : {}) } : current);
    };
    window.addEventListener("modudadam:profile-updated", updateNickname);
    return () => window.removeEventListener("modudadam:profile-updated", updateNickname);
  }, []);

  useEffect(() => {
    const updateCount = (event: Event) => {
      const count = (event as CustomEvent<{ visitorCount?: number }>).detail?.visitorCount;
      if (typeof count === "number") setVisitorCount(count);
    };
    window.addEventListener("modudadam:visitor-count", updateCount);
    apiRequest<{ visitorCount: number }>("/api/visitors/presence", { cache: "no-store" })
      .then((data) => setVisitorCount(data.visitorCount)).catch(() => undefined);
    return () => window.removeEventListener("modudadam:visitor-count", updateCount);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  function goBack() {
    closeMenu();
    const fallback = pathname.startsWith("/play/") ? "/play"
      : pathname.startsWith("/my/") ? "/my"
      : "/";
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer?.origin === window.location.origin) return router.back();
    } catch { /* 잘못된 referrer는 상위 화면으로 이동 */ }
    router.push(fallback);
  }

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

  if (pathname === "/login" || pathname === "/signup/agreements") {
    return <header className="site-header login-site-header"><button type="button" className="global-back-button auth-back-button" onClick={goBack} aria-label="이전 화면으로 돌아가기"><ArrowLeft size={23} /></button><Link href="/" className="brand"><span className="brand-mark"><Image src="/brand/modudadam-brand-mark.png" alt="" width={38} height={38} priority /></span><strong>모두다담</strong></Link></header>;
  }

  return (
    <header className={`site-header ${pathname !== "/" ? "has-back" : ""}`}>
      {pathname !== "/" && <button type="button" className="global-back-button" onClick={goBack} aria-label="이전 화면으로 돌아가기"><ArrowLeft size={23} strokeWidth={2.1} /></button>}
      {pathname !== "/" && <Link href="/" className="header-home-button" aria-label="홈으로 이동"><Home size={22} strokeWidth={1.9} /></Link>}
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
            <Link href="/my" className="drawer-account-profile" onClick={closeMenu}><span className="drawer-account-avatar"><Image className={user.avatarUrl ? undefined : "default-avatar"} src={user.avatarUrl || "/brand/modudadam-avatar-clean.png"} alt="" width={44} height={44} unoptimized={Boolean(user.avatarUrl)} /></span>
            <span className="drawer-account-copy"><small>마이페이지</small><strong><StampedName full name={user.nickname} stamp={user.stampEmoji} /></strong></span><ChevronRight size={18} /></Link>
            <button type="button" className="drawer-logout" onClick={logout} disabled={loggingOut}><LogOut size={16} /> {loggingOut ? "처리 중" : "로그아웃"}</button>
          </div> : <Link href="/login" className="drawer-account drawer-account-guest" onClick={closeMenu}>
            <span className="drawer-account-avatar"><CircleUserRound size={25} /></span>
            <span className="drawer-account-copy"><small>모두다담에 오신 걸 환영해요</small><strong>로그인</strong></span>
            <ChevronRight size={19} />
          </Link>)}
          <h2>커뮤니티</h2>
          <div className="drawer-grid drawer-special-boards">{specialBoards.map((board) => { const Icon=board.icon;return <Link href={`/category/${board.code}`} key={board.code} onClick={closeMenu}><span className={`drawer-icon category-${board.code}`}><Icon size={24} strokeWidth={1.9}/></span><span className="drawer-label">{board.name}</span></Link>; })}</div>
          <h2>카테고리</h2>
          <CategoryGrid onNavigate={closeMenu}/>
          <h2>다담 콘텐츠</h2>
          <div className="dadam-content-links">
            <Link href="/play/attendance" onClick={closeMenu}><span className="dadam-link-icon green"><CalendarCheck2/></span><span><strong>다담 출석부</strong><small>스탬프를 찍고 도토리 모으기</small></span><ChevronRight/></Link>
            <Link href="/play/stamps" onClick={closeMenu}><span className="dadam-link-icon purple"><Gift/></span><span><strong>도토리 스탬프 상점</strong><small>도토리로 대표 스탬프 꾸미기</small></span><ChevronRight/></Link>
            <Link href="/play/acorn-gift" onClick={closeMenu}><span className="dadam-link-icon amber"><HandCoins/></span><span><strong>도토리 선물하기</strong><small>이웃에게 도토리와 마음 전하기</small></span><ChevronRight/></Link>
            <Link href="/play/missions" onClick={closeMenu}><span className="dadam-link-icon amber"><Trophy/></span><span><strong>다담 미션</strong><small>생활 퀴즈를 풀고 도토리 모으기</small></span><ChevronRight/></Link>
            <Link href="/play/detective" onClick={closeMenu}><span className="dadam-link-icon blue"><ShieldQuestion/></span><span><strong>다담 추리방</strong><small>열 명의 용의자 중 진실 찾기</small></span><ChevronRight/></Link>
            <Link href="/play/time-capsule" onClick={closeMenu}><span className="dadam-link-icon purple"><Hourglass/></span><span><strong>다담 타임캡슐</strong><small>미래의 나에게 마음 봉인하기</small></span><ChevronRight/></Link>
            <Link href="/play/choice" onClick={closeMenu}><span className="dadam-link-icon coral"><Vote/></span><span><strong>오늘의 극한 밸런스</strong><small>피할 수 없는 오늘의 양자택일</small></span><ChevronRight/></Link>
            <Link href="/play/mailbox" onClick={closeMenu}><span className="dadam-link-icon blue"><Mail/></span><span><strong>다담 우체통</strong><small>고정 익명 ID로 나누는 마음</small></span><ChevronRight/></Link>
            <Link href="/play/taste" onClick={closeMenu}><span className="dadam-link-icon purple"><Sparkles/></span><span><strong>취향 발견실</strong><small>10문항으로 알아보는 생활 취향</small></span><ChevronRight/></Link>
            <Link href="/play/treasures" onClick={closeMenu}><span className="dadam-link-icon green"><MapPin/></span><span><strong>동네 보물지도</strong><small>이웃이 발견한 좋은 장소</small></span><ChevronRight/></Link>
            <Link href="/play/random" onClick={closeMenu}><span className="dadam-link-icon amber"><Compass/></span><span><strong>랜덤 이야기 여행</strong><small>숨은 게시글 우연히 만나기</small></span><ChevronRight/></Link>
          </div>
          <h2>서비스 바로가기</h2>
          <div className="service-links"><Link href="/" onClick={closeMenu}><Home /> 홈</Link><Link href="/events" onClick={closeMenu}><CalendarHeart /> 이벤트</Link><Link href="/search" onClick={closeMenu}><Search /> 통합검색</Link>{user && <Link href="/my" onClick={closeMenu}><UserRound /> 마이페이지</Link>}{canViewVisitors&&<Link href="/admin/reports" onClick={closeMenu}><Flag/> 신고 검토</Link>}</div>
        </div>
      </div>
      <Link href="/" className="brand" onClick={closeMenu}><span className="brand-mark"><Image src="/brand/modudadam-brand-mark.png" alt="" width={38} height={38} priority /></span><strong>모두다담</strong></Link>
      {canViewVisitors ? (
        <Link className="header-visitor-count header-visitor-link" href="/admin/visitors" title="오늘 방문자 목록 보기">
          <i aria-hidden="true" />오늘 {visitorCount === null ? "-" : visitorCount.toLocaleString()}명
        </Link>
      ) : (
        <span className="header-visitor-count" title="한국 시간 기준 오늘 방문한 중복 제외 방문자"><i aria-hidden="true" />오늘 {visitorCount === null ? "-" : visitorCount.toLocaleString()}명</span>
      )}
    </header>
  );
}
