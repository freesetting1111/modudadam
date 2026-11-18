import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock3, LogIn, MapPin, MonitorSmartphone, Network, Search, UsersRound } from "lucide-react";
import { getServerSessionUser } from "@/lib/auth";
import { API_SERVER_URL } from "@/lib/server-config";

const VISITOR_ADMIN_EMAIL = "freesetting@naver.com";

export const metadata: Metadata = {
  title: "오늘 방문자",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Visitor = {
  identityKey: string;
  anonymousId: string | null;
  userId: string | null;
  nickname: string | null;
  email: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastPath: string | null;
  device: string;
  ipAddress: string | null;
};

type VisitorResponse = {
  success: true;
  data: {
    visitDate: string;
    timezone: string;
    totalCount: number;
    page: number;
    pageSize: number;
    totalPages: number;
    visitors: Visitor[];
  };
};

type PageProps = {
  searchParams: Promise<{ date?: string | string[]; q?: string | string[]; page?: string | string[] }>;
};

export default async function VisitorAdminPage({ searchParams }: PageProps) {
  const user = await getServerSessionUser();
  if (!user) redirect("/login?returnTo=%2Fadmin%2Fvisitors");
  if (user.email?.trim().toLowerCase() !== VISITOR_ADMIN_EMAIL) notFound();

  const params = await searchParams;
  const selectedDate = singleValue(params.date);
  const keyword = singleValue(params.q);
  const requestedPage = singleValue(params.page) || "1";
  const apiParams = new URLSearchParams({ page: requestedPage });
  if (selectedDate) apiParams.set("date", selectedDate);
  if (keyword) apiParams.set("q", keyword);
  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${API_SERVER_URL}/api/admin/visitors?${apiParams}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("오늘 방문자 목록을 불러오지 못했습니다.");
  const body = await response.json() as VisitorResponse;
  const { visitDate, totalCount, page, pageSize, totalPages, visitors } = body.data;

  return (
    <section className="visitor-admin-page">
      <header className="visitor-admin-heading">
        <Link href="/" aria-label="홈으로 돌아가기"><ArrowLeft size={21} /></Link>
        <div><small>임시 운영 메뉴</small><h1>방문자 조회</h1><p>{formatVisitDate(visitDate)} · 검색 결과 {totalCount.toLocaleString()}명</p></div>
        <span><UsersRound size={25} /></span>
      </header>

      <form className="visitor-admin-filters" action="/admin/visitors" method="get">
        <label><span>방문 날짜</span><input type="date" name="date" defaultValue={visitDate} /></label>
        <label><span>검색어</span><div><Search size={17} /><input type="search" name="q" defaultValue={keyword} placeholder="닉네임, 이메일, IP, 경로" /></div></label>
        <div className="visitor-filter-actions"><Link href="/admin/visitors">초기화</Link><button type="submit">조회하기</button></div>
      </form>

      <div className="visitor-result-summary"><strong>{totalCount.toLocaleString()}명</strong><span>최근 방문 순 · 페이지당 {pageSize}명</span></div>
      <div className="visitor-admin-list">
        {visitors.length ? visitors.map((visitor, index) => (
          <article className="visitor-admin-card" key={visitor.identityKey}>
            <div className={`visitor-avatar ${visitor.userId ? "member" : "guest"}`}>
              {visitor.userId ? <LogIn size={20} /> : <UsersRound size={20} />}
            </div>
            <div className="visitor-admin-copy">
              <div className="visitor-admin-name">
                <strong>{visitor.nickname || `비회원 ${shortId(visitor.anonymousId)}`}</strong>
                <span>{visitor.userId ? "회원" : "비회원"}</span>
                <em>#{(page - 1) * pageSize + index + 1}</em>
              </div>
              {visitor.email && <p className="visitor-email">{visitor.email}</p>}
              <dl>
                <div><dt><Clock3 size={13} /> 최초 방문</dt><dd>{formatTime(visitor.firstSeenAt)}</dd></div>
                <div><dt><Clock3 size={13} /> 최근 방문</dt><dd>{formatTime(visitor.lastSeenAt)}</dd></div>
                <div><dt><MapPin size={13} /> 마지막 화면</dt><dd>{friendlyPath(visitor.lastPath)}</dd></div>
                <div><dt><MonitorSmartphone size={13} /> 접속 기기</dt><dd>{visitor.device}</dd></div>
                <div><dt><Network size={13} /> 접속 IP</dt><dd>{visitor.ipAddress || "확인되지 않음"}</dd></div>
              </dl>
            </div>
          </article>
        )) : <div className="visitor-admin-empty"><UsersRound size={31} /><strong>조건에 맞는 방문자가 없습니다.</strong><span>날짜나 검색어를 바꿔 다시 조회해 보세요.</span></div>}
      </div>
      <VisitorPagination page={page} totalPages={totalPages} date={visitDate} keyword={keyword} />
    </section>
  );
}

function VisitorPagination({ page, totalPages, date, keyword }: { page: number; totalPages: number; date: string; keyword: string }) {
  if (totalPages <= 1) return null;
  const pages = pageNumbers(page, totalPages);
  return <nav className="visitor-pagination" aria-label="방문자 목록 페이지">
    {page > 1 ? <Link href={pageHref(page - 1, date, keyword)} aria-label="이전 페이지"><ChevronLeft size={18}/></Link> : <span aria-hidden="true"><ChevronLeft size={18}/></span>}
    {pages.map((number) => <Link key={number} href={pageHref(number, date, keyword)} className={number === page ? "active" : undefined} aria-current={number === page ? "page" : undefined}>{number}</Link>)}
    {page < totalPages ? <Link href={pageHref(page + 1, date, keyword)} aria-label="다음 페이지"><ChevronRight size={18}/></Link> : <span aria-hidden="true"><ChevronRight size={18}/></span>}
  </nav>;
}

function pageNumbers(page: number, totalPages: number) {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function pageHref(page: number, date: string, keyword: string) {
  const params = new URLSearchParams({ date, page: String(page) });
  if (keyword) params.set("q", keyword);
  return `/admin/visitors?${params}`;
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function shortId(value: string | null) {
  return value ? value.replaceAll("-", "").slice(0, 6).toUpperCase() : "UNKNOWN";
}

function formatVisitDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(`${value}T00:00:00+09:00`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Seoul" }).format(new Date(value));
}

function friendlyPath(path: string | null) {
  if (!path || path === "/") return "홈";
  if (path.startsWith("/category/")) return `게시판 · ${decodeURIComponent(path.split("/")[2] || "")}`;
  if (path.startsWith("/posts/")) return "게시글 상세";
  if (path.startsWith("/play/")) return "다담 콘텐츠";
  if (path.startsWith("/my")) return "마이페이지";
  if (path.startsWith("/search")) return "검색";
  if (path.startsWith("/login")) return "로그인";
  return path;
}
