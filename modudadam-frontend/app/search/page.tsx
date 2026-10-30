import Link from "next/link";
import { categories } from "@/lib/categories";
export default function SearchPage() { return <section className="content-page"><h1>통합검색</h1><form className="search-form"><input name="q" placeholder="생활 정보와 이야기를 검색하세요"/><button>검색</button></form><h2>카테고리로 찾기</h2><div className="search-categories">{categories.map((category) => { const Icon = category.icon; return <Link key={category.code} href={`/category/${category.code}`}><span className={`search-category-icon category-${category.code}`}><Icon size={19} /></span>{category.name}</Link>; })}</div></section>; }
