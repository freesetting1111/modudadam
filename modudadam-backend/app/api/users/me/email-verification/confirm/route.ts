import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { confirmProfileEmailVerification } from "@/domains/profile/profile.repository";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const code = String(body.code ?? "").replace(/\D/g, "");
    if (!email || !/^\d{6}$/.test(code)) return errorResponse("6자리 인증번호를 입력해 주세요.");

    const profile = await confirmProfileEmailVerification(user.id, email, code);
    if (!profile) return errorResponse("인증번호가 올바르지 않거나 만료되었습니다.");
    return jsonResponse({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "EMAIL_TAKEN") return errorResponse("다른 계정에서 사용 중인 이메일입니다.", 409);
    console.error("[profile-email-confirm]", error);
    return errorResponse("이메일을 인증하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
