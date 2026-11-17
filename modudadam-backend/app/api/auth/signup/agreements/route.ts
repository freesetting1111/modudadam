import type { NextRequest } from "next/server";
import { completeOAuthLoginTicket, getOAuthLoginTicket } from "@/domains/auth/auth.repository";
import { sessionCookie } from "@/domains/auth/session";
import { isNicknameAvailable } from "@/domains/profile/profile.repository";
import { isValidNickname, normalizeNickname } from "@/domains/profile/nickname";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const GENDERS = new Set(["male", "female", "other"]);
const AGE_RANGES = new Set(["10-19", "20-29", "30-39", "40-49", "50-59", "60+"]);

export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket") || "";
  if (!ticket) return errorResponse("가입 인증 정보가 없습니다. 다시 로그인해 주세요.", 401);
  const pending = await getOAuthLoginTicket(ticket);
  if (!pending || !pending.requires_agreement) {
    return errorResponse("가입 인증이 만료되었습니다. 다시 로그인해 주세요.", 401);
  }
  if (request.nextUrl.searchParams.has("nickname")) {
    const nickname = normalizeNickname(request.nextUrl.searchParams.get("nickname"));
    if (!isValidNickname(nickname)) {
      return errorResponse("닉네임은 한글, 영문 소문자, 숫자로 2~20자리까지 입력해 주세요.");
    }
    return jsonResponse({
      available: await isNicknameAvailable(nickname, pending.user_id || undefined),
    });
  }
  return jsonResponse({
    provider: pending.provider,
    nickname: pending.profile.nickname || null,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ticket = String(body.ticket || "");
    if (!ticket) return errorResponse("가입 인증 정보가 없습니다. 다시 로그인해 주세요.", 401);
    if (!body.ageOver14 || !body.agreeTerms || !body.agreePrivacy) {
      return errorResponse("필수 약관에 모두 동의해 주세요.");
    }
    const nickname = normalizeNickname(body.nickname);
    const gender = String(body.gender || "");
    const ageRange = String(body.ageRange || "");
    const phoneNumber = String(body.phoneNumber || "").replace(/\D/g, "");
    if (!isValidNickname(nickname)) {
      return errorResponse("닉네임은 한글, 영문 소문자, 숫자로 2~20자리까지 입력해 주세요.");
    }
    if (!GENDERS.has(gender)) return errorResponse("성별을 선택해 주세요.");
    if (!AGE_RANGES.has(ageRange)) return errorResponse("연령대를 선택해 주세요.");
    if (!/^01[016789]\d{7,8}$/.test(phoneNumber)) return errorResponse("휴대폰 번호 형식을 확인해 주세요.");
    const result = await completeOAuthLoginTicket(ticket, {
      ageOver14: true, terms: true, privacy: true, nickname, gender, ageRange, phoneNumber,
    }, request.headers.get("user-agent") || undefined);
    const response = jsonResponse({ returnTo: result.returnTo || "/" });
    response.headers.append("Set-Cookie", sessionCookie(result.sessionToken));
    return response;
  } catch (error) {
    if (error instanceof Error && ["OAUTH_TICKET_INVALID", "AGREEMENTS_REQUIRED"].includes(error.message)) {
      return errorResponse("가입 인증이 만료되었습니다. 다시 로그인해 주세요.", 401);
    }
    if (error instanceof Error && error.message === "NICKNAME_INVALID") {
      return errorResponse("닉네임은 한글, 영문 소문자, 숫자로 2~20자리까지 입력해 주세요.");
    }
    if (error instanceof Error && error.message === "NICKNAME_TAKEN") {
      return errorResponse("이미 사용 중인 닉네임입니다.", 409);
    }
    if (error instanceof Error && error.message === "PHONE_TAKEN") {
      return errorResponse("이미 등록된 휴대폰 번호입니다.", 409);
    }
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      const constraint = "constraint" in error ? String(error.constraint || "") : "";
      return constraint.includes("phone")
        ? errorResponse("이미 등록된 휴대폰 번호입니다.", 409)
        : errorResponse("이미 사용 중인 닉네임입니다.", 409);
    }
    console.error("[oauth-agreements]", error);
    return errorResponse("가입을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
