import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { getUserProfile, updateUserProfile } from "@/domains/profile/profile.repository";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const NICKNAME_PATTERN = /^[^\s\u0000-\u001f\u007f]{2,12}$/u;
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;
const PHONE_PATTERN = /^01[016789]\d{7,8}$/;

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
    const nickname = String(body.nickname ?? "").normalize("NFKC").trim();
    const statusMessage = String(body.statusMessage ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phoneNumber = String(body.phoneNumber ?? "").replace(/\D/g, "");

    if (!NICKNAME_PATTERN.test(nickname)) return errorResponse("닉네임은 공백 없이 2~12자리로 입력해 주세요.");
    if (statusMessage.length > 30) return errorResponse("상태 메시지는 30자리까지 입력할 수 있습니다.");
    if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) return errorResponse("이메일 형식을 확인해 주세요.");
    if (phoneNumber && !PHONE_PATTERN.test(phoneNumber)) return errorResponse("휴대폰 번호를 정확히 입력해 주세요.");

    const profile = await updateUserProfile(user.id, {
      nickname,
      statusMessage: statusMessage || null,
      email: email || null,
      phoneNumber: phoneNumber || null,
    });
    return jsonResponse({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "NICKNAME_TAKEN") return errorResponse("이미 사용 중인 닉네임입니다.", 409);
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return errorResponse("이미 사용 중인 닉네임, 이메일 또는 휴대폰 번호입니다.", 409);
    }
    console.error("[profile-update]", error);
    return errorResponse("프로필을 저장하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
