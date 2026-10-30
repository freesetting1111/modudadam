import type { NextRequest } from "next/server";
import { confirmFindId } from "@/domains/auth/recovery.repository";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    if (!email || code.length !== 8) return errorResponse("이메일과 8자리 인증번호를 확인해 주세요.");
    const maskedLoginId = await confirmFindId(email, code);
    return maskedLoginId ? jsonResponse({ maskedLoginId }) : errorResponse("인증번호가 올바르지 않거나 만료되었습니다.", 400);
  } catch (error) {
    console.error("[find-id-confirm]", error);
    return errorResponse("인증번호를 확인하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
