import type { NextRequest } from "next/server";
import { loginLocalUser } from "@/domains/auth/auth.repository";
import { sessionCookie } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const loginId = String(body.loginId || "").trim();
    const password = String(body.password || "");
    if (!loginId || !password) return errorResponse("아이디와 비밀번호를 입력해 주세요.");

    const token = await loginLocalUser(loginId, password, request.headers.get("user-agent") || undefined);
    const response = jsonResponse({ loggedIn: true });
    response.headers.append("Set-Cookie", sessionCookie(token));
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") return errorResponse("아이디 또는 비밀번호를 확인해 주세요.", 401);
    console.error("[local-login]", error);
    return errorResponse("로그인하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
