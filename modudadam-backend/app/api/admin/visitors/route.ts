import type { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const VISITOR_ADMIN_EMAIL = "freesetting@naver.com";

type VisitorRow = {
  identityKey: string;
  anonymousId: string | null;
  userId: string | null;
  nickname: string | null;
  email: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  lastPath: string | null;
  userAgent: string | null;
  ipAddress: string | null;
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return errorResponse("로그인이 필요합니다.", 401);
  if (user.email?.trim().toLowerCase() !== VISITOR_ADMIN_EMAIL) {
    return errorResponse("방문자 목록을 확인할 권한이 없습니다.", 403);
  }

  const requestedDate = request.nextUrl.searchParams.get("date") || getSeoulDate();
  const visitDate = isValidDate(requestedDate) ? requestedDate : getSeoulDate();
  const keyword = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize = 20;
  const filterSql = `visitors.visit_date=$1::date AND (
    $2::text='' OR COALESCE(users.nickname,'') ILIKE '%' || $2 || '%'
    OR COALESCE(users.email,'') ILIKE '%' || $2 || '%'
    OR COALESCE(host(visitors.ip_address),'') ILIKE '%' || $2 || '%'
    OR COALESCE(visitors.anonymous_id::text,'') ILIKE '%' || $2 || '%'
    OR COALESCE(visitors.last_path,'') ILIKE '%' || $2 || '%'
  )`;
  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
       FROM daily_visitors visitors
       LEFT JOIN users ON users.id=visitors.user_id
      WHERE ${filterSql}`,
    [visitDate, keyword],
  );
  const totalCount = countResult.rows[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const result = await query<VisitorRow>(
    `SELECT visitors.identity_key AS "identityKey",
            visitors.anonymous_id::text AS "anonymousId",
            visitors.user_id::text AS "userId",
            users.nickname,
            users.email,
            visitors.first_seen_at AS "firstSeenAt",
            visitors.last_seen_at AS "lastSeenAt",
            visitors.last_path AS "lastPath",
            visitors.user_agent AS "userAgent",
            host(visitors.ip_address) AS "ipAddress"
       FROM daily_visitors visitors
       LEFT JOIN users ON users.id=visitors.user_id
      WHERE ${filterSql}
      ORDER BY visitors.last_seen_at DESC
      LIMIT $3 OFFSET $4`,
    [visitDate, keyword, pageSize, (currentPage - 1) * pageSize],
  );

  return jsonResponse({
    visitDate,
    timezone: "Asia/Seoul",
    keyword,
    totalCount,
    page: currentPage,
    pageSize,
    totalPages,
    visitors: result.rows.map((visitor) => ({
      ...visitor,
      device: describeDevice(visitor.userAgent),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}

function getSeoulDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function describeDevice(userAgent: string | null) {
  if (!userAgent) return "기기 정보 없음";
  const device = /ipad|tablet/i.test(userAgent)
    ? "태블릿"
    : /mobile|iphone|android/i.test(userAgent)
      ? "모바일"
      : "PC";
  const browser = /edg\//i.test(userAgent)
    ? "Edge"
    : /whale\//i.test(userAgent)
      ? "Whale"
      : /chrome\//i.test(userAgent)
        ? "Chrome"
        : /safari\//i.test(userAgent)
          ? "Safari"
          : /firefox\//i.test(userAgent)
            ? "Firefox"
            : "기타 브라우저";
  return `${device} · ${browser}`;
}

export function OPTIONS() { return corsPreflightResponse(); }
