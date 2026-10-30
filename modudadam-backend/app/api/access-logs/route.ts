import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.path || typeof body.path !== "string") return errorResponse("path가 필요합니다.");
    const user = await getSessionUser(request);
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ipHash = forwarded ? createHash("sha256").update(`${process.env.ANALYTICS_IP_SALT || "dev"}:${forwarded}`).digest("hex") : null;
    await query(
      `INSERT INTO access_logs(event_name,anonymous_id,user_id,session_id,path,query_string,page_title,referrer,landing_url,
       utm_source,utm_medium,utm_campaign,utm_content,utm_term,gclid,fbclid,device_type,viewport_width,viewport_height,
       locale,timezone,user_agent,ip_hash,properties,occurred_at)
       VALUES($1,$2::uuid,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24::jsonb,COALESCE($25::timestamptz,now()))`,
      [body.eventName||"page_view",body.anonymousId||null,user?.id||null,body.sessionId||null,body.path,body.queryString||null,
       body.pageTitle||null,body.referrer||null,body.landingUrl||null,body.utmSource||null,body.utmMedium||null,
       body.utmCampaign||null,body.utmContent||null,body.utmTerm||null,body.gclid||null,body.fbclid||null,
       body.deviceType||null,body.viewportWidth||null,body.viewportHeight||null,body.locale||null,body.timezone||null,
       request.headers.get("user-agent"),ipHash,JSON.stringify(body.properties||{}),body.occurredAt||null],
    );
    return jsonResponse({ accepted: true }, { status: 202 });
  } catch { return errorResponse("접근 로그를 저장하지 못했습니다.", 500); }
}
export function OPTIONS(){return corsPreflightResponse();}
