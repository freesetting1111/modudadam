import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { query } from "@/lib/db";

type Dimension = "neuroticism" | "extraversion" | "openness" | "agreeableness" | "conscientiousness";
type QuestionRow = { id: string; dimension: Dimension; question: string; options: Array<{ label: string; score: number }> };
const dimensions: Dimension[] = ["neuroticism","extraversion","openness","agreeableness","conscientiousness"];

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) return errorResponse("취향 발견실을 이용하려면 로그인이 필요합니다.",401);
  const questions = await query<QuestionRow>(
    `WITH available AS (
       SELECT bank.*,CASE WHEN exposure.question_id IS NULL THEN 0 ELSE 1 END AS used
         FROM taste_question_bank bank
         LEFT JOIN taste_question_exposures exposure ON exposure.question_id=bank.id AND exposure.user_id=$1::uuid
        WHERE bank.enabled
     ), ranked AS (
       SELECT id::text,dimension,question,options,
              row_number() OVER(PARTITION BY dimension ORDER BY used,random()) AS rn
         FROM available
     )
     SELECT id,dimension,question,options FROM ranked WHERE rn<=2 ORDER BY random()`,[user.id],
  );
  if (questions.rows.length === 10) await query(
    `INSERT INTO taste_question_exposures(user_id,question_id)
     SELECT $1::uuid,unnest($2::bigint[]) ON CONFLICT(user_id,question_id) DO UPDATE SET seen_at=now()`,
    [user.id,questions.rows.map((question) => question.id)],
  );
  const latest = await query(
    `SELECT quiz_code AS "quizCode",result_code AS "resultCode",created_at AS "createdAt"
       FROM taste_quiz_results WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`, [user.id],
  );
  return jsonResponse({ questions: questions.rows, latestResult: latest.rows[0] || null });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const action = body.action === "save" ? "save" : "analyze";
    const answers: Array<{ questionId: string; score: number }> = Array.isArray(body.answers) ? body.answers.slice(0,10).map((answer: unknown) => {
      const item = answer as { questionId?: unknown; score?: unknown };
      return { questionId: String(item?.questionId || ""), score: Number(item?.score) };
    }) : [];
    if (answers.length !== 10 || new Set(answers.map((answer) => answer.questionId)).size !== 10) return errorResponse("10개 문항에 모두 답해 주세요.");
    if (answers.some((answer) => !/^\d+$/.test(answer.questionId) || !Number.isInteger(answer.score) || answer.score < -2 || answer.score > 2)) return errorResponse("검사 답변이 올바르지 않습니다.");
    const bank = await query<QuestionRow>(
      `SELECT id::text,dimension,question,options FROM taste_question_bank WHERE enabled AND id=ANY($1::bigint[])`,
      [answers.map((answer) => answer.questionId)],
    );
    if (bank.rows.length !== 10) return errorResponse("검사 문항을 다시 불러와 주세요.");
    const byId = new Map(bank.rows.map((question) => [question.id,question]));
    const scores: Record<Dimension,number> = { neuroticism:0,extraversion:0,openness:0,agreeableness:0,conscientiousness:0 };
    const counts: Record<Dimension,number> = { neuroticism:0,extraversion:0,openness:0,agreeableness:0,conscientiousness:0 };
    for (const answer of answers) {
      const question = byId.get(answer.questionId);
      if (!question || !question.options.some((option) => option.score === answer.score)) return errorResponse("선택한 답변을 확인할 수 없습니다.");
      scores[question.dimension] += answer.score;
      counts[question.dimension] += 1;
    }
    if (dimensions.some((dimension) => counts[dimension] < 2)) return errorResponse("분석 문항의 구성이 올바르지 않습니다.");
    const dominant = [...dimensions].sort((a,b) => Math.abs(scores[b]) - Math.abs(scores[a]))[0];
    const resultCode = dimensions.map((dimension) => scoreBand(scores[dimension])).join("") + dominant[0].toUpperCase();
    if (action === "save" && user) await query(
      `INSERT INTO taste_quiz_results(user_id,quiz_code,result_code,answers) VALUES($1,'lifestyle-bank-v3',$2,$3::jsonb)`,
      [user.id,resultCode,JSON.stringify(answers)],
    );
    return jsonResponse({ scores,resultCode,saved:action === "save" }, { status: action === "save" ? 201 : 200 });
  } catch {
    return errorResponse("취향 분석 결과를 계산하지 못했습니다.",500);
  }
}
function scoreBand(score: number) { return score >= 3 ? "H" : score <= -3 ? "L" : "M"; }
export function OPTIONS() { return corsPreflightResponse(); }
