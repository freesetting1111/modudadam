import type { NextRequest } from "next/server";
import { registerLocalUser } from "@/domains/auth/auth.repository";
import { sessionCookie } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const LOGIN_ID_PATTERN = /^(?!.*[A-Z])[\x21-\x7E]{4,12}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9])[\x21-\x7E]{8,20}$/;
const PHONE_PATTERN = /^01[016789]\d{7,8}$/;
const REAL_NAME_PATTERN = /^[가-힣A-Za-z]{2,30}$/;
const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const loginId = String(body.loginId || "").trim();
    const password = String(body.password || "");
    const realName = String(body.realName || "").trim();
    const phoneNumber = String(body.phoneNumber || "").replace(/\D/g, "");
    const email = String(body.email || "").trim().toLowerCase();

    if (!LOGIN_ID_PATTERN.test(loginId)) return errorResponse("아이디는 영문 소문자, 숫자, 특수문자로 4~12자리만 입력할 수 있습니다.");
    if (!PASSWORD_PATTERN.test(password)) return errorResponse("비밀번호는 영문, 숫자, 특수문자를 조합한 8~20자리여야 합니다.");
    if (!REAL_NAME_PATTERN.test(realName)) return errorResponse("이름은 공백 없이 한글 또는 영문 2~30자리만 입력할 수 있습니다.");
    if (!PHONE_PATTERN.test(phoneNumber)) return errorResponse("휴대폰 번호를 정확히 입력해 주세요.");
    if (!EMAIL_PATTERN.test(email) || email.length > 254) return errorResponse("이메일 형식을 확인해 주세요.");
    if (!body.agreeTerms || !body.agreePrivacy) return errorResponse("이용약관과 개인정보 수집에 동의해 주세요.");

    const token = await registerLocalUser({ loginId, password, realName, phoneNumber, email }, request.headers.get("user-agent") || undefined);
    const response = jsonResponse({ registered: true }, { status: 201 });
    response.headers.append("Set-Cookie", sessionCookie(token));
    return response;
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return errorResponse("이미 사용 중인 아이디, 이메일 또는 휴대폰 번호입니다.", 409);
    console.error("[local-register]", error);
    return errorResponse("회원가입을 완료하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
