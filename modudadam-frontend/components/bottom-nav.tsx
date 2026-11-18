"use client";

import Link from "next/link";
import { House, Search, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";

const baseItems = [
  { href: "/", icon: House, label: "홈" },
  { href: "/search", icon: Search, label: "검색" },
] as const;

export function BottomNav({ authenticated }: { authenticated: boolean }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/signup/agreements") return null;
  const items = [...baseItems, { href: authenticated ? "/my" : "/login?returnTo=%2Fmy", activeHref: "/my", icon: UserRound, label: "마이" }] as const;
  const isComposePage = /^\/category\/[^/]+\/write$/.test(pathname) || /^\/posts\/[^/]+\/edit$/.test(pathname);
  if (isComposePage) return null;
  return <nav className="bottom-nav" aria-label="하단 메뉴">{items.map(({ href, icon: Icon, label, ...item }) => {
    const activeHref = "activeHref" in item ? item.activeHref : href;
    const active = activeHref === "/" ? pathname === "/" : pathname.startsWith(activeHref);
    return <Link href={href} key={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><span><Icon size={22} strokeWidth={active ? 2.4 : 1.8} /></span><small>{label}</small></Link>;
  })}</nav>;
}
