import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const LOGIN_ID_PATTERN = /^(?!.*[A-Z])[\x21-\x7E]{4,12}$/;

export async function GET(request: NextRequest) {
  const loginId = request.nextUrl.searchParams.get("loginId")?.trim() || "";
  if (!LOGIN_ID_PATTERN.test(loginId)) return errorResponse("아이디는 영문 소문자, 숫자, 특수문자로 4~12자리만 입력할 수 있습니다.");
  const result = await query("SELECT 1 FROM user_local_accounts WHERE lower(login_id)=lower($1) LIMIT 1", [loginId]);
  return jsonResponse({ available: result.rowCount === 0 });
}

export function OPTIONS() { return corsPreflightResponse(); }
