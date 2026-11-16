import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { getUserProfile, updateUserProfile } from "@/domains/profile/profile.repository";
import { isValidNickname, normalizeNickname } from "@/domains/profile/nickname";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const GENDERS = new Set(["", "male", "female", "other"]);
const AGE_RANGES = new Set(["", "10-19", "20-29", "30-39", "40-49", "50-59", "60+"]);

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const profile = await getUserProfile(user.id);
    return profile ? jsonResponse({ profile }) : errorResponse("회원 정보를 찾을 수 없습니다.", 404);
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("프로필을 불러오지 못했습니다.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const nickname = normalizeNickname(body.nickname);
    const statusMessage = String(body.statusMessage ?? "").trim();
    const gender = String(body.gender ?? "");
    const ageRange = String(body.ageRange ?? "");

    if (!isValidNickname(nickname)) return errorResponse("닉네임은 한글, 영문, 숫자로 2~20자리까지 입력해 주세요.");
    if (statusMessage.length > 30) return errorResponse("상태 메시지는 30자리까지 입력할 수 있습니다.");
    if (!GENDERS.has(gender)) return errorResponse("성별 선택값을 확인해 주세요.");
    if (!AGE_RANGES.has(ageRange)) return errorResponse("연령대 선택값을 확인해 주세요.");

    const profile = await updateUserProfile(user.id, {
      nickname,
      statusMessage: statusMessage || null,
      gender: gender || null,
      ageRange: ageRange || null,
    });
    return jsonResponse({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "NICKNAME_TAKEN") return errorResponse("이미 사용 중인 닉네임입니다.", 409);
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return errorResponse("이미 사용 중인 닉네임입니다.", 409);
    }
    console.error("[profile-update]", error);
    return errorResponse("프로필을 저장하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
