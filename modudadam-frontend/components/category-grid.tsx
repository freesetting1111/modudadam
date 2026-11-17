"use client";

import Link from "next/link";
import { categories } from "@/lib/categories";

type CategoryGridProps = {
  selectedCode?: string;
  onSelect?: (code: string) => void;
  onNavigate?: () => void;
  className?: string;
};

export function CategoryGrid({ selectedCode, onSelect, onNavigate, className = "" }: CategoryGridProps) {
  return <div className={`drawer-grid ${className}`.trim()} role={onSelect ? "group" : undefined} aria-label={onSelect ? "게시판 선택" : undefined}>
    {categories.map((category) => {
      const Icon = category.icon;
      const content = <><span className={`drawer-icon category-${category.code}`}><Icon size={24} strokeWidth={1.9}/></span><span className="drawer-label">{category.short}</span></>;
      return onSelect
        ? <button key={category.code} type="button" className={selectedCode === category.code ? "active" : ""} aria-pressed={selectedCode === category.code} onClick={() => onSelect(category.code)}>{content}</button>
        : <Link href={`/category/${category.code}`} key={category.code} onClick={onNavigate}>{content}</Link>;
    })}
  </div>;
}
