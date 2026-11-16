import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { isNicknameAvailable } from "@/domains/profile/profile.repository";
import { isValidNickname, normalizeNickname } from "@/domains/profile/nickname";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const nickname = normalizeNickname(request.nextUrl.searchParams.get("nickname"));
    if (!isValidNickname(nickname)) return errorResponse("닉네임은 한글, 영문, 숫자로 2~20자리까지 입력해 주세요.");
    return jsonResponse({ available: await isNicknameAvailable(nickname, user.id) });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("닉네임 중복 여부를 확인하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
