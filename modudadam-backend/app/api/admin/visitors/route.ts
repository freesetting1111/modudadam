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
  landingUrl: string | null; utmSource: string | null; utmMedium: string | null;
  utmCampaign: string | null; utmTerm: string | null; gclid: string | null; fbclid: string | null;
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
      OR COALESCE(logs.page_title,'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.referrer,'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.utm_source,'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.utm_medium,'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.utm_campaign,'') ILIKE '%' || $3 || '%'
      OR COALESCE(logs.utm_term,'') ILIKE '%' || $3 || '%')`;
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
            host(logs.ip_address) AS "ipAddress", logs.referrer, logs.landing_url AS "landingUrl",
            logs.utm_source AS "utmSource", logs.utm_medium AS "utmMedium",
            logs.utm_campaign AS "utmCampaign", logs.utm_term AS "utmTerm", logs.gclid, logs.fbclid
       FROM access_logs logs LEFT JOIN users ON users.id=logs.user_id
      WHERE ${filterSql}
      ORDER BY logs.occurred_at DESC, logs.id DESC LIMIT $4 OFFSET $5`,
    [...values, PAGE_SIZE, (currentPage - 1) * PAGE_SIZE],
  );
  return jsonResponse({ startDate, endDate, timezone: "Asia/Seoul", keyword, totalCount,
    page: currentPage, pageSize: PAGE_SIZE, totalPages,
    logs: result.rows.map((log) => ({
      ...log,
      device: describeDevice(log.userAgent, log.deviceType),
      trafficSource: describeTrafficSource(log),
    })),
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

type TrafficChannel = "direct" | "organic_search" | "paid" | "social" | "referral" | "campaign";

function describeTrafficSource(log: AccessLogRow): { channel: TrafficChannel; label: string; detail: string | null } {
  const source = log.utmSource?.trim().toLowerCase() || "";
  const medium = log.utmMedium?.trim().toLowerCase() || "";
  const referrer = parseReferrer(log.referrer);
  const sourceName = friendlySourceName(source || referrer?.hostname || "");
  const campaignDetail = compactDetail(log.utmCampaign && `캠페인 ${log.utmCampaign}`, log.utmTerm && `검색어 ${log.utmTerm}`);

  if (log.gclid) return { channel: "paid", label: "구글 광고", detail: campaignDetail || "Google Ads 클릭" };
  if (log.fbclid) return { channel: "paid", label: "메타 광고", detail: campaignDetail || "Facebook · Instagram 클릭" };
  if (isPaidMedium(medium)) return { channel: "paid", label: `${sourceName || "외부"} 광고`, detail: campaignDetail || medium };
  if (medium === "organic" || searchEngineName(source) || searchEngineName(referrer?.hostname || "")) {
    const engine = searchEngineName(source) || searchEngineName(referrer?.hostname || "") || "검색엔진";
    return { channel: "organic_search", label: `${engine} 검색`, detail: campaignDetail || extractSearchTerm(referrer?.url || null) };
  }
  if (isSocialMedium(medium) || socialSourceName(source) || socialSourceName(referrer?.hostname || "")) {
    const social = socialSourceName(source) || socialSourceName(referrer?.hostname || "") || sourceName || "소셜 미디어";
    return { channel: "social", label: `${social} 유입`, detail: campaignDetail || referrer?.hostname || null };
  }
  if (source === "direct" || medium === "direct" || (!source && !referrer)) {
    return { channel: "direct", label: "직접 유입", detail: "주소 입력 · 즐겨찾기 · 출처 정보 없음" };
  }
  if (medium === "referral" || referrer) {
    return { channel: "referral", label: `${sourceName || referrer?.hostname || "외부 사이트"} 링크`, detail: campaignDetail || referrer?.hostname || null };
  }
  return { channel: "campaign", label: `${sourceName || "외부"} 캠페인`, detail: campaignDetail || medium || null };
}

function parseReferrer(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return { url, hostname: url.hostname.toLowerCase().replace(/^www\./, "") };
  } catch { return null; }
}

function searchEngineName(value: string) {
  const normalized = value.toLowerCase().replace(/^www\./, "");
  if (normalized === "google" || normalized === "google.com" || normalized.startsWith("google.")) return "구글";
  if (normalized === "naver" || normalized.startsWith("search.naver.")) return "네이버";
  if (normalized === "daum" || normalized === "search.daum.net") return "다음";
  if (normalized === "bing" || normalized === "bing.com" || normalized.endsWith(".bing.com")) return "빙";
  if (normalized === "zum" || normalized === "search.zum.com") return "줌";
  if (normalized === "yahoo" || normalized.startsWith("search.yahoo.")) return "야후";
  return null;
}

function socialSourceName(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("instagram")) return "인스타그램";
  if (normalized.includes("facebook") || normalized === "meta") return "페이스북";
  if (normalized === "x" || normalized.includes("twitter") || normalized === "t.co") return "X(트위터)";
  if (normalized.includes("youtube") || normalized === "youtu.be") return "유튜브";
  if (normalized.includes("kakao")) return "카카오";
  return null;
}

function friendlySourceName(value: string) {
  return searchEngineName(value) || socialSourceName(value) || value.toLowerCase().replace(/^www\./, "").slice(0, 100) || null;
}

function isPaidMedium(value: string) { return /(^|_)(cpc|ppc|paid|paidsearch|paid_social|display|ads?)($|_)/.test(value); }
function isSocialMedium(value: string) { return value === "social" || value === "social_media"; }

function extractSearchTerm(url: URL | null) {
  if (!url) return null;
  const value = url.searchParams.get("query") || url.searchParams.get("q") || url.searchParams.get("keyword") || url.searchParams.get("p");
  return value?.trim() ? `검색어 ${value.trim().slice(0, 100)}` : null;
}

function compactDetail(...values: Array<string | null | undefined>) {
  const details = values.filter((value): value is string => Boolean(value));
  return details.length ? details.join(" · ") : null;
}
export function OPTIONS() { return corsPreflightResponse(); }
