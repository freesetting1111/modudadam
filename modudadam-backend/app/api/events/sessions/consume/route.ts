import { NextRequest } from "next/server";
import { consumeEventTicket, EventError } from "@/domains/events/events.service";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try {
    const { ticket } = await request.json() as { ticket?: string };
    if (!ticket) return errorResponse("이벤트 진입 티켓이 필요합니다.", 400);
    return jsonResponse(await consumeEventTicket(ticket), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof EventError) return errorResponse(error.message, error.status);
    console.error("Failed to consume event ticket", error);
    return errorResponse("이벤트 진입 처리 중 오류가 발생했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
