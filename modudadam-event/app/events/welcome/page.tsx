import Link from "next/link";
import { requireEventSession } from "@/shared/event-session";

export const dynamic = "force-dynamic";
export default async function WelcomeEventPage() {
  await requireEventSession("1", "/events/welcome");
  const mainUrl = process.env.MODUDADAM_MAIN_URL || "http://localhost:3005";
  return <div className="event-shell"><header className="event-header"><Link href={mainUrl} className="event-brand"><span className="event-brand-mark">🐿️</span>모두다담</Link></header><main className="event-main"><span className="event-kicker">MODUDADAM EVENT</span><h1>이벤트 라운지에<br/>오신 것을 환영해요.</h1><p className="event-lead">이 페이지는 앞으로 새로운 이벤트를 추가할 때 복사해서 사용하는 안전한 이벤트 템플릿입니다.</p><section className="event-welcome-card"><div className="event-welcome-visual">🎁</div><h2>새로운 이벤트를 준비하고 있어요</h2><p>메인 서비스와는 별도로 배포되지만, 모두다담 회원과 참여 기록은 안전하게 연결됩니다.</p></section><p className="event-note">새 이벤트는 이 프로젝트에 페이지를 추가하고, 백엔드의 event_definitions에 경로와 공개 기간을 등록하면 됩니다.</p><Link className="event-back" href={`${mainUrl}/events`}>이벤트 목록으로</Link></main></div>;
}
