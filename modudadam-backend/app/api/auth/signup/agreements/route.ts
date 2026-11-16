import type { NextRequest } from "next/server";
import { completeOAuthLoginTicket, getOAuthLoginTicket } from "@/domains/auth/auth.repository";
import { sessionCookie } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket") || "";
  if (!ticket) return errorResponse("가입 인증 정보가 없습니다. 다시 로그인해 주세요.", 401);
  const pending = await getOAuthLoginTicket(ticket);
  if (!pending || !pending.requires_agreement) {
    return errorResponse("가입 인증이 만료되었습니다. 다시 로그인해 주세요.", 401);
  }
  return jsonResponse({
    provider: pending.provider,
    nickname: pending.profile.nickname || null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ticket = String(body.ticket || "");
    if (!ticket) return errorResponse("가입 인증 정보가 없습니다. 다시 로그인해 주세요.", 401);
    if (!body.ageOver14 || !body.agreeTerms || !body.agreePrivacy) {
      return errorResponse("필수 약관에 모두 동의해 주세요.");
    }
    const result = await completeOAuthLoginTicket(ticket, {
      ageOver14: true, terms: true, privacy: true,
    }, request.headers.get("user-agent") || undefined);
    const response = jsonResponse({ returnTo: result.returnTo || "/" });
    response.headers.append("Set-Cookie", sessionCookie(result.sessionToken));
    return response;
  } catch (error) {
    if (error instanceof Error && ["OAUTH_TICKET_INVALID", "AGREEMENTS_REQUIRED"].includes(error.message)) {
      return errorResponse("가입 인증이 만료되었습니다. 다시 로그인해 주세요.", 401);
    }
    console.error("[oauth-agreements]", error);
    return errorResponse("가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
