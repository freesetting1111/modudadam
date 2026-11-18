import { isIP } from "node:net";
import type { NextRequest } from "next/server";
import { db, query } from "@/lib/db";
import { getSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOT_PATTERN = /bot|crawler|spider|headless|lighthouse|phantomjs|selenium|puppeteer|playwright|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|naverbot|yeti/i;
const HUMAN_VISITOR_SQL = `COALESCE(user_agent,'') !~* '(bot|crawler|spider|headless|lighthouse|phantomjs|selenium|puppeteer|playwright|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|naverbot|yeti)'`;

export async function GET() {
  const count = await getTodayVisitorCount();
  return jsonResponse({ visitorCount: count, period: "today", timezone: "Asia/Seoul" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { anonymousId?: unknown; path?: unknown };
    const user = await getSessionUser(request);
    const anonymousId = typeof body.anonymousId === "string" && UUID_PATTERN.test(body.anonymousId) ? body.anonymousId : null;
    const userAgent = request.headers.get("user-agent") || "";
    if (BOT_PATTERN.test(userAgent)) return jsonResponse({ visitorCount: await getTodayVisitorCount(), period: "today", timezone: "Asia/Seoul" });
    if (!user && !anonymousId) return errorResponse("방문자 식별값이 필요합니다.");

    const path = typeof body.path === "string" ? body.path.slice(0, 2000) : null;
    const ipAddress = getClientIp(request);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      let identityKey = user ? `user:${user.id}` : `anonymous:${anonymousId}`;
      if (!user && anonymousId) {
        const linkedUser = await client.query<{ identityKey: string }>(
          `SELECT identity_key AS "identityKey" FROM daily_visitors
           WHERE visit_date=(NOW() AT TIME ZONE 'Asia/Seoul')::date
             AND anonymous_id=$1::uuid AND user_id IS NOT NULL
           LIMIT 1`,
          [anonymousId],
        );
        if (linkedUser.rows[0]) identityKey = linkedUser.rows[0].identityKey;
      }
      if (user && anonymousId) {
        await client.query(
          `DELETE FROM daily_visitors
           WHERE visit_date=(NOW() AT TIME ZONE 'Asia/Seoul')::date AND identity_key=$1`,
          [`anonymous:${anonymousId}`],
        );
      }
      await client.query(
        `INSERT INTO daily_visitors(visit_date,identity_key,anonymous_id,user_id,last_path,user_agent,ip_address)
         VALUES((NOW() AT TIME ZONE 'Asia/Seoul')::date,$1,$2::uuid,$3::uuid,$4,$5,$6::inet)
         ON CONFLICT(visit_date,identity_key) DO UPDATE SET
           anonymous_id=COALESCE(EXCLUDED.anonymous_id,daily_visitors.anonymous_id),
           user_id=COALESCE(EXCLUDED.user_id,daily_visitors.user_id),last_path=EXCLUDED.last_path,
           user_agent=EXCLUDED.user_agent,
           ip_address=COALESCE(EXCLUDED.ip_address,daily_visitors.ip_address),last_seen_at=NOW()`,
        [identityKey, anonymousId, user?.id || null, path, userAgent, ipAddress],
      );
      const count = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM daily_visitors
         WHERE visit_date=(NOW() AT TIME ZONE 'Asia/Seoul')::date AND ${HUMAN_VISITOR_SQL}`,
      );
      await client.query("COMMIT");
      return jsonResponse({ visitorCount: count.rows[0]?.count || 0, period: "today", timezone: "Asia/Seoul" });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } catch (error) {
    console.error("[visitors] failed to update presence", error);
    return errorResponse("접속자 정보를 갱신하지 못했습니다.", 500);
  }
}

function getClientIp(request: NextRequest) {
  const candidates = [
    request.headers.get("x-modudadam-client-ip"),
    request.headers.get("cf-connecting-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("x-forwarded-for"),
  ];

  for (const header of candidates) {
    for (const rawValue of header?.split(",") || []) {
      let value = rawValue.trim();
      if (value.startsWith("[") && value.includes("]")) value = value.slice(1, value.indexOf("]"));
      if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) value = value.slice(0, value.lastIndexOf(":"));
      if (isIP(value)) return value;
    }
  }
  return null;
}

async function getTodayVisitorCount() {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM daily_visitors
     WHERE visit_date=(NOW() AT TIME ZONE 'Asia/Seoul')::date AND ${HUMAN_VISITOR_SQL}`,
  );
  return result.rows[0]?.count || 0;
}

export function OPTIONS() { return corsPreflightResponse(); }
