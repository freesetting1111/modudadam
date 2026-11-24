import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart, UsersRound } from "lucide-react";
import { API_SERVER_URL } from "@/lib/server-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title:"이벤트",description:"모두다담에서 진행 중인 이벤트와 참여 현황을 확인하세요.",
  alternates:{ canonical:"/events" },robots:{ index:true,follow:true },
  openGraph:{ type:"website",title:"이벤트 | 모두다담",description:"모두다담에서 진행 중인 이벤트와 참여 현황을 확인하세요.",url:"/events",siteName:"모두다담",locale:"ko_KR" },
};

type PublicEvent = {
  eventNo: string; slug: string; title: string; description: string | null;
  badge: string | null; thumbnailUrl: string | null; entryPath: string; participantCount: number;
};

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ eventError?: string }> }) {
  const [{ eventError }, events] = await Promise.all([searchParams, loadEvents()]);
  return <section className="event-hub">
    <header className="event-hub-hero"><span><CalendarHeart size={26}/></span><div><small>이벤트</small><h1>모두다담 이벤트</h1><p>진행 중인 이벤트를 확인하세요.</p></div></header>
    {eventError && <p className="event-hub-error">이벤트를 열지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
    <div className="event-hub-heading"><h2>진행 중인 이벤트</h2><span>{events.length}개</span></div>
    {events.length ? <div className="event-card-list">{events.map((event) =>
      <Link key={event.eventNo} href={`/events/${event.eventNo}?next=${encodeURIComponent(event.entryPath)}`} className="event-card">
        <div className="event-card-copy">{event.badge && <b>{event.badge}</b>}<h3>{event.title}</h3><p>{event.description}</p><small><UsersRound size={14}/>{event.participantCount.toLocaleString("ko-KR")}명 참여</small></div><span className="event-card-arrow">›</span>
      </Link>)}</div> : <div className="event-hub-empty"><CalendarHeart size={32}/><strong>준비 중인 이벤트가 있어요</strong><p>새로운 이벤트가 열리면 이곳에서 알려드릴게요.</p></div>}
  </section>;
}

async function loadEvents(): Promise<PublicEvent[]> {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/events/public`, { cache: "no-store" });
    if (!response.ok) return [];
    const body = await response.json() as { success: boolean; data?: { events?: PublicEvent[] } };
    return body.success ? body.data?.events || [] : [];
  } catch { return []; }
}
