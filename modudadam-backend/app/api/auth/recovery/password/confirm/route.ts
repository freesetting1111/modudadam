import type { NextRequest } from "next/server";
import { resetPassword } from "@/domains/auth/recovery.repository";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,20}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const loginId = String(body.loginId || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const newPassword = String(body.newPassword || "");
    if (!email || code.length !== 8) return errorResponse("이메일과 8자리 인증번호를 확인해 주세요.");
    if (!PASSWORD_PATTERN.test(newPassword)) return errorResponse("비밀번호는 영문, 숫자, 특수문자를 조합한 8~20자리여야 합니다.");
    if (!(await resetPassword(loginId, email, code, newPassword))) return errorResponse("인증번호가 올바르지 않거나 만료되었습니다.", 400);
    return jsonResponse({ reset: true });
  } catch (error) {
    console.error("[password-reset-confirm]", error);
    return errorResponse("비밀번호를 변경하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
