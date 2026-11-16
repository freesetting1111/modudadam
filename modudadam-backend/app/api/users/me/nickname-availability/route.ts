import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { isNicknameAvailable } from "@/domains/profile/profile.repository";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const NICKNAME_PATTERN = /^[^\s\u0000-\u001f\u007f]{2,12}$/u;

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const nickname = String(request.nextUrl.searchParams.get("nickname") ?? "").normalize("NFKC").trim();
    if (!NICKNAME_PATTERN.test(nickname)) return errorResponse("닉네임은 공백 없이 2~12자리로 입력해 주세요.");
    return jsonResponse({ available: await isNicknameAvailable(nickname, user.id) });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("닉네임 중복 여부를 확인하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
