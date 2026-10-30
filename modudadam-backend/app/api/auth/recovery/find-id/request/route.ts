import type { NextRequest } from "next/server";
import { issueFindIdCode, invalidateRecoveryCode } from "@/domains/auth/recovery.repository";
import { sendRecoveryEmail } from "@/domains/auth/email";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const realName = String(body.realName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    if (!realName || !email) return errorResponse("이름과 이메일을 입력해 주세요.");
    const issued = await issueFindIdCode(realName, email);
    if (!issued) return errorResponse("일치하는 계정을 찾을 수 없습니다.", 404);
    try { await sendRecoveryEmail(issued.email, issued.code, "find_id"); }
    catch (error) { await invalidateRecoveryCode(issued.id); throw error; }
    return jsonResponse({ sent: true });
  } catch (error) {
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") return errorResponse("이메일 발송 설정이 필요합니다.", 503);
    console.error("[find-id-request]", error);
    return errorResponse("인증번호를 발송하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
