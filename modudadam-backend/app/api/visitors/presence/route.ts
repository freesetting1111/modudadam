import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { db, query } from "@/lib/db";
import { getSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const ACTIVE_WINDOW_MINUTES = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BOT_PATTERN = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|kakaotalk-scrap|naverbot|yeti/i;

export async function GET() {
  const count = await getOnlineCount();
  return jsonResponse({ onlineCount: count, activeWindowMinutes: ACTIVE_WINDOW_MINUTES }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { anonymousId?: unknown; path?: unknown };
    const user = await getSessionUser(request);
    const anonymousId = typeof body.anonymousId === "string" && UUID_PATTERN.test(body.anonymousId) ? body.anonymousId : null;
    const userAgent = request.headers.get("user-agent") || "";
    if (BOT_PATTERN.test(userAgent)) return jsonResponse({ onlineCount: await getOnlineCount(), activeWindowMinutes: ACTIVE_WINDOW_MINUTES });
    if (!user && !anonymousId) return errorResponse("방문자 식별값이 필요합니다.");

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ipHash = forwarded ? createHash("sha256").update(`${process.env.ANALYTICS_IP_SALT || "dev"}:${forwarded}`).digest("hex") : null;
    const identityKey = user ? `user:${user.id}` : `anonymous:${anonymousId}`;
    const path = typeof body.path === "string" ? body.path.slice(0, 2000) : null;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      if (user && anonymousId) await client.query("DELETE FROM visitor_presence WHERE identity_key=$1", [`anonymous:${anonymousId}`]);
      await client.query(
        `INSERT INTO visitor_presence(identity_key,anonymous_id,user_id,ip_hash,last_path,user_agent)
         VALUES($1,$2::uuid,$3::uuid,$4,$5,$6)
         ON CONFLICT(identity_key) DO UPDATE SET anonymous_id=EXCLUDED.anonymous_id,user_id=EXCLUDED.user_id,
           ip_hash=EXCLUDED.ip_hash,last_path=EXCLUDED.last_path,user_agent=EXCLUDED.user_agent,last_seen_at=NOW()`,
        [identityKey, anonymousId, user?.id || null, ipHash, path, userAgent],
      );
      const count = await client.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM visitor_presence
         WHERE last_seen_at >= NOW() - ($1::int * INTERVAL '1 minute')`,
        [ACTIVE_WINDOW_MINUTES],
      );
      await client.query("COMMIT");
      return jsonResponse({ onlineCount: count.rows[0]?.count || 0, activeWindowMinutes: ACTIVE_WINDOW_MINUTES });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } catch (error) {
    console.error("[visitors] failed to update presence", error);
    return errorResponse("접속자 정보를 갱신하지 못했습니다.", 500);
  }
}

async function getOnlineCount() {
  const result = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM visitor_presence
     WHERE last_seen_at >= NOW() - ($1::int * INTERVAL '1 minute')`,
    [ACTIVE_WINDOW_MINUTES],
  );
  return result.rows[0]?.count || 0;
}

export function OPTIONS() { return corsPreflightResponse(); }
