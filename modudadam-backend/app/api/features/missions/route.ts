import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const kstDate = () => new Intl.DateTimeFormat("en-CA",{ timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
const validCategory = (value:string) => /^[a-z0-9-]{2,50}$/.test(value);

export async function GET(request:NextRequest) {
  try {
    const user = await getSessionUser(request); const category = request.nextUrl.searchParams.get("category"); const today=kstDate();
    if (!category) {
      const categories = await query<{ code:string;name:string;icon:string;completedToday:boolean }>(
        `SELECT categories.code,categories.name,categories.icon,
          EXISTS(SELECT 1 FROM daily_mission_attempts attempts WHERE attempts.category_code=categories.code AND attempts.user_id=$1::uuid AND attempts.mission_on=$2::date AND attempts.completed_at IS NOT NULL) AS "completedToday"
         FROM categories WHERE categories.is_active ORDER BY categories.sort_order`,[user?.id || null,today]);
      const wallet = user ? await query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1`,[user.id]) : null;
      return jsonResponse({ categories:categories.rows,walletBalance:wallet?.rows[0]?.balance || 0,today });
    }
    const member = await requireSessionUser(request);
    if (!validCategory(category)) return errorResponse("카테고리를 확인해 주세요.");
    await ensureDailyMission(category,today);
    await query(
      `WITH selected AS (
         SELECT question_id FROM daily_mission_questions
         WHERE mission_on=$3::date AND category_code=$2::text
         ORDER BY md5(question_id::text || $1::text || $3) LIMIT 3
       )
       INSERT INTO daily_mission_attempts(user_id,category_code,mission_on,question_ids)
       SELECT $1::uuid,$2::text,$3::date,array_agg(question_id ORDER BY question_id) FROM selected
       HAVING count(*)=3 ON CONFLICT(user_id,category_code,mission_on) DO NOTHING`,
      [member.id,category,today]);
    const attempt = await query<{ id:string;questionIds:string[];attemptCount:number;completed:boolean }>(
      `SELECT attempts.id,ARRAY(SELECT unnest(attempts.question_ids)::text) AS "questionIds",attempts.attempt_count AS "attemptCount",(attempts.completed_at IS NOT NULL) AS completed
       FROM daily_mission_attempts attempts WHERE attempts.user_id=$1::uuid AND attempts.category_code=$2::text AND attempts.mission_on=$3::date`,
      [member.id,category,today]);
    if (!attempt.rows[0]) return errorResponse("오늘의 미션 문제를 준비하지 못했습니다.",503);
    const questions = await query<{ id:string;question:string;options:string[] }>(
      `SELECT id::text,question,ARRAY(SELECT jsonb_array_elements_text(options)) AS options
       FROM mission_question_bank WHERE id=ANY($1::bigint[]) ORDER BY array_position($1::bigint[],id)`,
      [attempt.rows[0].questionIds]);
    const categoryInfo = await query<{ code:string;name:string }>(`SELECT code,name FROM categories WHERE code=$1 AND is_active`,[category]);
    if (!categoryInfo.rows[0]) return errorResponse("카테고리를 찾을 수 없습니다.",404);
    return jsonResponse({ category:categoryInfo.rows[0],attemptId:attempt.rows[0].id,attemptCount:attempt.rows[0].attemptCount,completed:attempt.rows[0].completed,questions:questions.rows });
  } catch(error) {
    console.error("[missions] failed to load daily mission",error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("미션에 참여하려면 로그인이 필요합니다.",401);
    return errorResponse("오늘의 미션을 불러오지 못했습니다.",500);
  }
}

export async function POST(request:NextRequest) {
  try {
    const user=await requireSessionUser(request); const body=await request.json(); const category=String(body.category || ""); const today=kstDate();
    const answers:Array<{ questionId:string;selectedIndex:number }> = Array.isArray(body.answers) ? body.answers.map((answer:unknown) => { const item=answer as { questionId?:unknown;selectedIndex?:unknown }; return { questionId:String(item.questionId || ""),selectedIndex:Number(item.selectedIndex) }; }) : [];
    if (!validCategory(category) || answers.length!==3 || answers.some((answer) => !/^\d+$/.test(answer.questionId) || !Number.isInteger(answer.selectedIndex) || answer.selectedIndex<0 || answer.selectedIndex>3) || new Set(answers.map((answer) => answer.questionId)).size!==3) return errorResponse("세 문제에 모두 답해 주세요.");
    const client=await db.connect();
    try {
      await client.query("BEGIN");
      const attempt=await client.query<{ id:string;questionIds:string[];rewarded:boolean }>(`SELECT id,ARRAY(SELECT unnest(question_ids)::text) AS "questionIds",(rewarded_at IS NOT NULL) AS rewarded FROM daily_mission_attempts WHERE user_id=$1 AND category_code=$2 AND mission_on=$3::date FOR UPDATE`,[user.id,category,today]);
      const current=attempt.rows[0];
      if (!current || answers.some((answer) => !current.questionIds.includes(answer.questionId))) { await client.query("ROLLBACK"); return errorResponse("오늘 배정된 문제를 다시 확인해 주세요.",409); }
      const bank=await client.query<{ id:string;correctIndex:number;explanation:string }>(`SELECT id::text,correct_index AS "correctIndex",explanation FROM mission_question_bank WHERE id=ANY($1::bigint[])`,[current.questionIds]);
      const byId=new Map(bank.rows.map((question) => [question.id,question]));
      const results=answers.map((answer) => { const question=byId.get(answer.questionId)!; return { questionId:answer.questionId,correct:question.correctIndex===answer.selectedIndex,correctIndex:question.correctIndex,explanation:question.explanation }; });
      const completed=results.every((result) => result.correct); let reward=0; let walletFull=false;
      await client.query(`UPDATE daily_mission_attempts SET attempt_count=attempt_count+1,completed_at=CASE WHEN $2 THEN COALESCE(completed_at,now()) ELSE completed_at END,updated_at=now() WHERE id=$1`,[current.id,completed]);
      if (completed && !current.rewarded) {
        await client.query(`UPDATE daily_mission_attempts SET rewarded_at=now() WHERE id=$1`,[current.id]);
        await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
        const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[user.id]);
        reward=(wallet.rows[0]?.balance || 0)<9999 ? 1 : 0; walletFull=reward===0;
        if (reward) {
          await client.query(`UPDATE acorn_wallets SET balance=balance+1,lifetime_earned=lifetime_earned+1,updated_at=now() WHERE user_id=$1`,[user.id]);
          await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES($1,1,'mission_complete',$2,$3)`,[user.id,`${today}:${category}`,`${category} 오늘의 미션 완료`]);
        }
      }
      await client.query("COMMIT"); return jsonResponse({ completed,reward,walletFull,results });
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch(error) {
    console.error("[missions] failed to submit answers",error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("미션에 참여하려면 로그인이 필요합니다.",401);
    return errorResponse("미션 답안을 확인하지 못했습니다.",500);
  }
}

async function ensureDailyMission(category:string,today:string) {
  const variant=(Math.floor(new Date(`${today}T00:00:00Z`).getTime()/86400000)%20)+1;
  await query(
    `INSERT INTO daily_mission_questions(mission_on,category_code,slot,question_id)
     SELECT $1::date,$2::text,row_number() OVER(ORDER BY concepts.sort_order),bank.id
     FROM mission_question_concepts concepts JOIN mission_question_bank bank
       ON bank.category_code=concepts.category_code AND bank.concept_key=concepts.concept_key AND bank.variant_no=$3::smallint AND bank.enabled
     WHERE concepts.category_code=$2::text
     ON CONFLICT(mission_on,category_code,slot) DO NOTHING`,[today,category,variant]);
}
export function OPTIONS() { return corsPreflightResponse(); }
