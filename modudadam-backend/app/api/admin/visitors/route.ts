import type { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const VISITOR_ADMIN_EMAIL = "freesetting@naver.com";
const PAGE_SIZE = 20;

type AccessLogRow = {
  id: string; anonymousId: string | null; userId: string | null;
  nickname: string | null; email: string | null; occurredAt: string;
  path: string; pageTitle: string | null; deviceType: string | null;
  userAgent: string | null; ipAddress: string | null; referrer: string | null;
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return errorResponse("로그인이 필요합니다.", 401);
  if (user.email?.trim().toLowerCase() !== VISITOR_ADMIN_EMAIL) return errorResponse("접속 로그를 확인할 권한이 없습니다.", 403);

  const today = getSeoulDate();
  const requestedStart = request.nextUrl.searchParams.get("startDate") || request.nextUrl.searchParams.get("date") || today;
  const requestedEnd = request.nextUrl.searchParams.get("endDate") || request.nextUrl.searchParams.get("date") || today;
  let startDate = isValidDate(requestedStart) ? requestedStart : today;
  let endDate = isValidDate(requestedEnd) ? requestedEnd : today;
  if (startDate > endDate) [startDate, endDate] = [endDate, startDate];
  const keyword = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const requestedPage = Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filterSql = `logs.event_name='page_view'
    AND logs.occurred_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Seoul')
    AND logs.occurred_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Seoul')
    AND ($3::text='' OR COALESCE(users.nickname,'') ILIKE '%' || $3 || '%'
      OR COALESCE(users.email,'') ILIKE '%' || $3 || '%'
      OR COALESCE(host(logs.ip_address),'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.anonymous_id::text,'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.path,'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.page_title,'') ILIKE '%' || $3 || '%')`;
  const values = [startDate, endDate, keyword];
  const countResult = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM access_logs logs LEFT JOIN users ON users.id=logs.user_id WHERE ${filterSql}`,
    values,
  );
  const totalCount = countResult.rows[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const result = await query<AccessLogRow>(
    `SELECT logs.id::text AS id, logs.anonymous_id::text AS "anonymousId", logs.user_id::text AS "userId",
            users.nickname, users.email, logs.occurred_at AS "occurredAt", logs.path,
            logs.page_title AS "pageTitle", logs.device_type AS "deviceType", logs.user_agent AS "userAgent",
            host(logs.ip_address) AS "ipAddress", logs.referrer
       FROM access_logs logs LEFT JOIN users ON users.id=logs.user_id
      WHERE ${filterSql}
      ORDER BY logs.occurred_at DESC, logs.id DESC LIMIT $4 OFFSET $5`,
    [...values, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE],
  );
  return jsonResponse({ startDate, endDate, timezone: "Asia/Seoul", keyword, totalCount,
    page: currentPage, pageSize: PAGE_SIZE, totalPages,
    logs: result.rows.map((log) => ({ ...log, device: describeDevice(log.userAgent, log.deviceType) })),
  }, { headers: { "Cache-Control": "no-store" } });
}

function getSeoulDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function describeDevice(userAgent: string | null, deviceType: string | null) {
  const device = deviceType === "mobile" ? "모바일" : deviceType === "tablet" ? "태블릿" : "PC";
  if (!userAgent) return device;
  const browser = /edg\//i.test(userAgent) ? "Edge" : /whale\//i.test(userAgent) ? "Whale"
    : /chrome\//i.test(userAgent) ? "Chrome" : /safari\//i.test(userAgent) ? "Safari"
      : /firefox\//i.test(userAgent) ? "Firefox" : "기타 브라우저";
  return `${device} · ${browser}`;
}
export function OPTIONS() { return corsPreflightResponse(); }
