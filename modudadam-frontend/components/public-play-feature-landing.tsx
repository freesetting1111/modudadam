import Link from "next/link";
import {
  CalendarCheck2, Compass, Gift, Hourglass, Mail, MapPin, ShieldQuestion, ShoppingBag, Sparkles, Trophy, Vote,
} from "lucide-react";
import { getSiteUrl } from "@/lib/site-url";
import type { PublicPlayFeature } from "@/lib/public-play-features";

const icons={
  "acorn-gift":Gift,calendar:CalendarCheck2,choice:Vote,detective:ShieldQuestion,mailbox:Mail,missions:Trophy,
  stamps:ShoppingBag,taste:Sparkles,"time-capsule":Hourglass,treasures:MapPin,
};

export function PublicPlayFeatureLanding({ feature }:{ feature:PublicPlayFeature }) {
  const Icon=icons[feature.icon];
  const structuredData={
    "@context":"https://schema.org","@type":"WebPage",name:feature.title,description:feature.description,
    url:`${getSiteUrl()}${feature.path}`,isPartOf:{ "@type":"WebSite",name:"모두다담",url:getSiteUrl() },
  };
  return <section className={`public-play-landing ${feature.tone}`}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html:JSON.stringify(structuredData).replace(/</g,"\\u003c") }}/>
    <header className="public-play-hero">
      <span><Icon size={31}/></span>
      <div><small>{feature.eyebrow}</small><h1>{feature.title}</h1><p>{feature.description}</p></div>
    </header>
    <section className="public-play-intro" aria-labelledby={`${feature.code}-intro-title`}>
      <div><Compass size={20}/><h2 id={`${feature.code}-intro-title`}>이렇게 이용해요</h2></div>
      <p>{feature.summary}</p>
      <div className="public-play-points">{feature.points.map((point)=><article key={point.title}><strong>{point.title}</strong><p>{point.description}</p></article>)}</div>
    </section>
    <div className="public-play-actions">
      <Link className="primary" href={`/login?returnTo=${encodeURIComponent(feature.path)}`}>{feature.actionLabel}</Link>
      <Link href="/play">다른 콘텐츠 보기</Link>
    </div>
    <p className="public-play-login-note">이 기능은 기록과 보상을 저장하기 위해 로그인이 필요합니다.</p>
  </section>;
}
