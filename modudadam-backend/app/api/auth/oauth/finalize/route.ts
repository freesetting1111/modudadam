import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { completeOAuthLoginTicket } from "@/domains/auth/auth.repository";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/domains/auth/session";

export async function GET(request: NextRequest) {
  const frontendUrl = process.env.OAUTH_SUCCESS_REDIRECT_URL || "http://localhost:3005";
  const failureUrl = process.env.OAUTH_FAILURE_REDIRECT_URL || `${frontendUrl}/login`;
  try {
    const ticket = request.nextUrl.searchParams.get("ticket") || "";
    const result = await completeOAuthLoginTicket(ticket, null, request.headers.get("user-agent") || undefined);
    const response = NextResponse.redirect(new URL(result.returnTo || "/", frontendUrl));
    response.cookies.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error("[oauth-finalize]", error);
    const url = new URL(failureUrl);
    url.searchParams.set("oauthError", "login_failed");
    return NextResponse.redirect(url);
  }
}
