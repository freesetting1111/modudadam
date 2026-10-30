import Image from "next/image";
import Link from "next/link";
import { categories } from "@/lib/categories";
import { HomeSearch } from "@/components/home-search";

const picks = [
  ["pets", "반려동물과 오래 행복하게 지내는 기본 건강 체크", "동물·반려동물", "12"],
  ["food", "오늘 저녁 20분 완성, 냉장고 재료로 만드는 한 그릇", "음식·요리", "28"],
  ["home", "좁은 집 수납이 달라지는 작은 습관 7가지", "집·주거·살림", "19"],
];

export default function Home() {
  return <>
    <HomeSearch />
    <section className="hero-card"><div><span className="eyebrow">모두의 일상을 다정하게</span><h1>알아두면 좋은 생활 이야기,<br />모두 다 담았어요.</h1><Link href="/about">모두다담 둘러보기 ›</Link></div><Image src="/brand/modudadam-squirrel.png" alt="도토리를 안은 모두다담 다람쥐" width={170} height={170} priority /></section>
    <section className="category-section"><div className="section-heading"><h2>카테고리</h2><span>12가지 생활 메뉴</span></div><div className="category-grid">{categories.map((category) => { const Icon = category.icon; return <Link href={`/category/${category.code}`} key={category.code}><span className={`category-icon category-${category.code}`}><Icon size={25} strokeWidth={1.9} /></span><span>{category.short}</span></Link>; })}</div></section>
    <section className="pick-section"><div className="section-heading"><h2>오늘의 추천 이야기</h2><Link href="/search">더보기 ›</Link></div><div className="pick-list">{picks.map(([code,title,category,comments], index) => <Link href={`/category/${code}`} className="pick-card" key={title}><div className={`pick-thumb pick-${index+1}`}><PickIcon code={code} /></div><div><span>{category}</span><h3>{title}</h3><small>읽기 3분 · 댓글 {comments}</small></div></Link>)}</div></section>
  </>;
}

function PickIcon({ code }: { code: string }) {
  const category = categories.find((item) => item.code === code);
  if (!category) return null;
  const Icon = category.icon;
  return <Icon size={31} strokeWidth={1.8} />;
}
