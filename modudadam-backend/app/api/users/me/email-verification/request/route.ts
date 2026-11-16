import type { NextRequest } from "next/server";
import { sendProfileEmailVerification } from "@/domains/auth/email";
import { requireSessionUser } from "@/domains/auth/session";
import {
  invalidateProfileEmailVerification,
  issueProfileEmailVerification,
} from "@/domains/profile/profile.repository";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return errorResponse("이메일 형식을 확인해 주세요.");
    }

    const verification = await issueProfileEmailVerification(user.id, email);
    try {
      await sendProfileEmailVerification(email, verification.code);
    } catch (error) {
      await invalidateProfileEmailVerification(verification.id);
      throw error;
    }
    return jsonResponse({ expiresIn: 300 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "EMAIL_TAKEN") return errorResponse("다른 계정에서 사용 중인 이메일입니다.", 409);
    if (error instanceof Error && error.message === "EMAIL_VERIFICATION_RATE_LIMIT") {
      return errorResponse("인증번호는 1분 후 다시 요청할 수 있습니다.", 429);
    }
    if (error instanceof Error && error.message === "SMTP_NOT_CONFIGURED") {
      return errorResponse("이메일 발송 설정이 필요합니다.", 503);
    }
    console.error("[profile-email-request]", error);
    return errorResponse("인증번호를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
