import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clock3, LogIn, MapPin, MonitorSmartphone, Network, Search, UsersRound } from "lucide-react";
import { getServerSessionUser } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/server-config";
import { AdminDatePicker } from "@/components/admin-date-picker";

const VISITOR_ADMIN_EMAIL = "freesetting@naver.com";
export const metadata: Metadata = { title: "접속 로그", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type AccessLog = {
  id: string; anonymousId: string | null; userId: string | null; nickname: string | null;
  email: string | null; occurredAt: string; path: string; pageTitle: string | null;
  device: string; ipAddress: string | null; referrer: string | null;
};
type LogResponse = { success: true; data: {
  startDate: string; endDate: string; totalCount: number; page: number; pageSize: number; totalPages: number; logs: AccessLog[];
} };
type PageProps = { searchParams: Promise<{ startDate?: string | string[]; endDate?: string | string[]; q?: string | string[]; page?: string | string[] }> };

export default async function VisitorAdminPage({ searchParams }: PageProps) {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=%2Fadmin%2Fvisitors");
  if (user.email?.trim().toLowerCase() !== VISITOR_ADMIN_EMAIL) notFound();
  const params = await searchParams;
  const apiParams = new URLSearchParams({ page: singleValue(params.page) || "1" });
  const requestedStart = singleValue(params.startDate);
  const requestedEnd = singleValue(params.endDate);
  const keyword = singleValue(params.q);
  if (requestedStart) apiParams.set("startDate", requestedStart);
  if (requestedEnd) apiParams.set("endDate", requestedEnd);
  if (keyword) apiParams.set("q", keyword);
  const response = await fetch(`${API_SERVER_URL}/api/admin/visitors?${apiParams}`, {
    headers: { cookie: (await cookies()).toString() }, cache: "no-store",
  });
  if (!response.ok) throw new Error("접속 로그를 불러오지 못했습니다.");
  const body = await response.json() as LogResponse;
  const { startDate, endDate, totalCount, page, pageSize, totalPages, logs } = body.data;

  return <section className="visitor-admin-page">
    <header className="visitor-admin-heading">
      <Link href="/" aria-label="홈으로 돌아가기"><ArrowLeft size={21} /></Link>
      <div><small>임시 운영 메뉴</small><h1>접속 로그</h1><p>{formatRange(startDate, endDate)} · 총 {totalCount.toLocaleString()}건</p></div>
      <span><UsersRound size={25} /></span>
    </header>
    <form className="visitor-admin-filters" action="/admin/visitors" method="get">
      <div className="visitor-date-range">
        <AdminDatePicker label="시작일" name="startDate" defaultValue={startDate}/>
        <AdminDatePicker label="종료일" name="endDate" defaultValue={endDate}/>
      </div>
      <label><span>검색어</span><div><Search size={17} /><input type="search" name="q" defaultValue={keyword} placeholder="닉네임, 이메일, IP, 경로" /></div></label>
      <div className="visitor-filter-actions"><Link href="/admin/visitors">초기화</Link><button type="submit">조회하기</button></div>
    </form>
    <div className="visitor-result-summary"><strong>총 {totalCount.toLocaleString()}건</strong><span>최근 기록 순 · 페이지당 {pageSize}건</span></div>
    <div className="visitor-admin-list">
      {logs.length ? logs.map((log) => <article className="visitor-admin-card" key={log.id}>
        <div className={`visitor-avatar ${log.userId ? "member" : "guest"}`}>{log.userId ? <LogIn size={20} /> : <UsersRound size={20} />}</div>
        <div className="visitor-admin-copy">
          <div className="visitor-admin-name"><strong>{log.nickname || `비회원 ${shortId(log.anonymousId)}`}</strong><span>{log.userId ? "회원" : "비회원"}</span></div>
          {log.email && <p className="visitor-email">{log.email}</p>}
          <dl>
            <div><dt><Clock3 size={13} /> 접속 시각</dt><dd>{formatDateTime(log.occurredAt)}</dd></div>
            <div><dt><MapPin size={13} /> 접속 화면</dt><dd title={log.path}>{friendlyPath(log.path)}</dd></div>
            <div><dt><MonitorSmartphone size={13} /> 접속 기기</dt><dd>{log.device}</dd></div>
            <div><dt><Network size={13} /> 접속 IP</dt><dd>{log.ipAddress || "기존 로그 · 저장 안 됨"}</dd></div>
          </dl>
          <p className="visitor-log-path">{log.path}</p>
        </div>
      </article>) : <div className="visitor-admin-empty"><UsersRound size={31} /><strong>조건에 맞는 접속 로그가 없습니다.</strong><span>조회 기간이나 검색어를 바꿔 다시 확인해 보세요.</span></div>}
    </div>
    <LogPagination page={page} totalPages={totalPages} startDate={startDate} endDate={endDate} keyword={keyword} />
  </section>;
}

function LogPagination({ page, totalPages, startDate, endDate, keyword }: { page: number; totalPages: number; startDate: string; endDate: string; keyword: string }) {
  const pages = pageNumbers(page, totalPages);
  return <nav className="visitor-pagination" aria-label="접속 로그 페이지">
    <span className="visitor-pagination-edge">
      {page > 1 ? <Link href={pageHref(1, startDate, endDate, keyword)} aria-label="가장 최신 접속 로그로 이동" title="가장 최신"><ChevronsLeft size={18}/></Link> : <span aria-hidden="true"><ChevronsLeft size={18}/></span>}
      {page > 1 ? <Link href={pageHref(page - 1, startDate, endDate, keyword)} aria-label="이전 페이지"><ChevronLeft size={18}/></Link> : <span aria-hidden="true"><ChevronLeft size={18}/></span>}
    </span>
    <span className="visitor-page-numbers">{pages.map((number) => <Link key={number} href={pageHref(number, startDate, endDate, keyword)} className={number === page ? "active" : undefined} aria-current={number === page ? "page" : undefined}>{number}</Link>)}</span>
    <span className="visitor-pagination-edge">
      {page < totalPages ? <Link href={pageHref(page + 1, startDate, endDate, keyword)} aria-label="다음 페이지"><ChevronRight size={18}/></Link> : <span aria-hidden="true"><ChevronRight size={18}/></span>}
      {page < totalPages ? <Link href={pageHref(totalPages, startDate, endDate, keyword)} aria-label="가장 이전 접속 로그로 이동" title="가장 이전"><ChevronsRight size={18}/></Link> : <span aria-hidden="true"><ChevronsRight size={18}/></span>}
    </span>
  </nav>;
}
function pageNumbers(page: number, totalPages: number) { const count=Math.min(10,totalPages);if(count<=0) return [];const start=Math.max(1,Math.min(page-Math.floor(count/2),totalPages-count+1));return Array.from({ length:count },(_,index)=>start+index); }
function pageHref(page: number, startDate: string, endDate: string, keyword: string) { const params = new URLSearchParams({ startDate, endDate, page: String(page) }); if (keyword) params.set("q", keyword); return `/admin/visitors?${params}`; }
function singleValue(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] || "" : value || ""; }
function shortId(value: string | null) { return value ? value.replaceAll("-", "").slice(0, 6).toUpperCase() : "UNKNOWN"; }
function formatRange(start: string, end: string) { return start === end ? formatDate(start) : `${formatDate(start)} ~ ${formatDate(end)}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(`${value}T00:00:00+09:00`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(value)); }
function friendlyPath(path: string) { if (path === "/") return "홈"; if (path.startsWith("/category/")) return "주제별 게시판"; if (path.startsWith("/posts/")) return "게시글 상세"; if (path.startsWith("/play/")) return "다담 콘텐츠"; if (path.startsWith("/my")) return "마이페이지"; if (path.startsWith("/search")) return "검색"; if (path.startsWith("/login")) return "로그인"; return path; }
