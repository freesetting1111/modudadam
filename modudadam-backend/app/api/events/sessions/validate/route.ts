import { NextRequest } from "next/server";
import { EventError, validateEventSessionToken } from "@/domains/events/events.service";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { eventNo?: string; eventSessionToken?: string };
    if (!body.eventNo || !body.eventSessionToken) return errorResponse("이벤트 번호와 세션 토큰이 필요합니다.", 400);
    return jsonResponse(await validateEventSessionToken(body.eventNo, body.eventSessionToken),
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof EventError) return errorResponse(error.message, error.status);
    console.error("Failed to validate event session", error);
    return errorResponse("이벤트 세션 확인 중 오류가 발생했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
