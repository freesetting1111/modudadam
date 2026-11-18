import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, Compass, Gift, Mail, MapPin, Shapes, Sparkles, Trophy, Vote } from "lucide-react";

export const metadata: Metadata = {
  title: "콘텐츠",
  description: "투표, 익명 우체통, 취향 테스트와 동네 이야기 등 모두다담의 참여형 콘텐츠를 만나보세요.",
};

const contentItems = [
  { href: "/play/attendance", icon: CalendarCheck2, tone: "green", eyebrow: "매일 한 번 스탬프", title: "다담 출석부", description: "매일 출석하고 도토리를 차곡차곡 모아보세요." },
  { href: "/play/stamps", icon: Gift, tone: "purple", eyebrow: "도토리로 꾸미는 프로필", title: "도토리 스탬프 상점", description: "등급별 스탬프를 둘러보고 대표 스탬프를 선택해 보세요." },
  { href: "/play/missions", icon: Trophy, tone: "amber", eyebrow: "매일 새로운 생활 퀴즈", title: "다담 미션", description: "16개 주제의 세 문제를 모두 맞히고 도토리를 모아보세요." },
  { href: "/play/choice", icon: Vote, tone: "coral", eyebrow: "매일 새로운 질문", title: "오늘의 선택", description: "둘 중 마음이 가는 쪽을 고르고 모두의 선택을 확인해 보세요." },
  { href: "/play/mailbox", icon: Mail, tone: "blue", eyebrow: "고정 익명 ID", title: "다담 우체통", description: "이름을 내려놓고 마음속 이야기와 따뜻한 답장을 나눠보세요." },
  { href: "/play/taste", icon: Sparkles, tone: "purple", eyebrow: "10문항 상세 분석", title: "취향 발견실", description: "5지선다 생활 질문으로 나도 몰랐던 취향의 결을 발견해 보세요." },
  { href: "/play/treasures", icon: MapPin, tone: "green", eyebrow: "이웃의 생활 지도", title: "동네 보물지도", description: "광고가 아닌 이웃이 직접 발견한 좋은 장소를 만나보세요." },
  { href: "/play/random", icon: Compass, tone: "amber", eyebrow: "숨은 게시글 발견", title: "랜덤 이야기 여행", description: "최신 목록 아래에 잠들어 있던 이야기를 우연히 만나보세요." },
] as const;

export default function PlayPage() {
  return <section className="content-hub-page">
    <header className="content-hub-hero"><span><Shapes size={27}/></span><div><small>MODUDADAM CONTENTS</small><h1>오늘은 무엇을 해볼까요?</h1><p>가볍게 참여하고, 새로운 취향과 이야기를 발견해 보세요.</p></div></header>
    <div className="content-hub-list">{contentItems.map(({ href, icon: Icon, tone, eyebrow, title, description }) => <Link href={href} key={href} className={`content-hub-card ${tone}`}>
      <span className="content-hub-icon"><Icon size={24}/></span><span className="content-hub-copy"><small>{eyebrow}</small><strong>{title}</strong><p>{description}</p></span><ArrowRight size={19}/>
    </Link>)}</div>
  </section>;
}
