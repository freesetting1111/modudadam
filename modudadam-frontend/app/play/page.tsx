import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, Compass, Gift, HandCoins, Hourglass, Mail, MapPin, Shapes, ShieldQuestion, Sparkles, Trophy, Vote } from "lucide-react";

export const metadata: Metadata = {
  title: "콘텐츠",
  description: "투표, 익명 우체통, 취향 테스트와 동네 이야기 등 모두다담의 참여형 콘텐츠를 만나보세요.",
  alternates: { canonical: "/play" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "콘텐츠",
    description: "투표, 익명 우체통, 취향 테스트와 동네 이야기 등 모두다담의 참여형 콘텐츠를 만나보세요.",
    url: "/play",
  },
};

const contentItems = [
  { href: "/play/attendance", icon: CalendarCheck2, tone: "green", eyebrow: "매일 한 번 스탬프", title: "다담 출석부", description: "매일 출석하고 도토리를 차곡차곡 모아보세요." },
  { href: "/play/stamps", icon: Gift, tone: "purple", eyebrow: "스탬프 구매와 포인트 전환", title: "도토리 상점", description: "스탬프를 구매하고 도토리를 악행 포인트로 전환해 보세요." },
  { href: "/play/acorn-gift", icon: HandCoins, tone: "amber", eyebrow: "이웃에게 전하는 마음", title: "도토리 선물하기", description: "고마운 이웃에게 메시지와 함께 도토리를 보내보세요." },
  { href: "/play/missions", icon: Trophy, tone: "amber", eyebrow: "매일 새로운 생활 퀴즈", title: "다담 미션", description: "16개 주제의 세 문제를 모두 맞히고 도토리를 모아보세요." },
  { href: "/play/detective", icon: ShieldQuestion, tone: "blue", eyebrow: "오늘의 사건 파일", title: "다담 추리방", description: "열 명의 용의자와 세 단서 속에서 거짓말한 한 사람을 찾아보세요." },
  { href: "/play/time-capsule", icon: Hourglass, tone: "purple", eyebrow: "미래의 나에게", title: "다담 타임캡슐", description: "오늘의 마음을 봉인하고 정해 둔 날 다시 열어보세요." },
  { href: "/play/choice", icon: Vote, tone: "coral", eyebrow: "오늘 단 한 번의 양자택일", title: "오늘의 극한 밸런스", description: "피할 수 없는 두 선택 중 하나를 고르고 모두의 답을 확인해 보세요." },
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
