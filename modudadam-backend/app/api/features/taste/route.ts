import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { query } from "@/lib/db";

const RESULT_CODES = new Set(["cozy", "curious", "balanced", "spark"]);

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return jsonResponse({ result: null });
  const result = await query(
    `SELECT quiz_code AS "quizCode",result_code AS "resultCode",created_at AS "createdAt"
     FROM taste_quiz_results WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user.id],
  );
  return jsonResponse({ result: result.rows[0] || null });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const quizCode = String(body.quizCode || "");
    const resultCode = String(body.resultCode || "");
    const answers = Array.isArray(body.answers) ? body.answers.map(String).slice(0, 20) : [];
    if (quizCode !== "daily-style-v1" || !RESULT_CODES.has(resultCode)) return errorResponse("검사 결과가 올바르지 않습니다.");
    const saved = await query(
      `INSERT INTO taste_quiz_results(user_id,quiz_code,result_code,answers) VALUES($1,$2,$3,$4::jsonb)
       RETURNING id,created_at AS "createdAt"`,
      [user.id, quizCode, resultCode, JSON.stringify(answers)],
    );
    return jsonResponse(saved.rows[0], { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    return errorResponse("결과를 저장하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
