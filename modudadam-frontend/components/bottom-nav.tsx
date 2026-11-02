"use client";

import Link from "next/link";
import { House, Search } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: House, label: "홈" },
  { href: "/search", icon: Search, label: "검색" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return <nav className="bottom-nav" aria-label="하단 메뉴">{items.map(({ href, icon: Icon, label }) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return <Link href={href} key={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}><span><Icon size={22} strokeWidth={active ? 2.4 : 1.8} /></span><small>{label}</small></Link>;
  })}</nav>;
}
