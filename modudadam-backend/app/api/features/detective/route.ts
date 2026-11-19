import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const kstDate = () => new Intl.DateTimeFormat("en-CA",{ timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());

type Attempt = {
  id:string;caseId:string;playOn:string;optionOrder:string[];selectedIds:string[];livesRemaining:number;
  hintsRevealed:number;status:"active"|"solved"|"failed";rewardAcorns:number;
};

export async function GET(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    const today=kstDate();
    await ensureAttempt(user.id,today);
    return jsonResponse(await loadGame(user.id,today));
  } catch(error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("추리방에 입장하려면 로그인이 필요합니다.",401);
    console.error("[detective] failed to load",error);
    return errorResponse("오늘의 사건을 불러오지 못했습니다.",500);
  }
}

export async function POST(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    const body=await request.json() as { suspectId?:unknown };
    const suspectId=String(body.suspectId || "");
    if (!/^\d+$/.test(suspectId)) return errorResponse("선택한 수사 결론을 확인해 주세요.");
    const today=kstDate();
    await ensureAttempt(user.id,today);
    const client=await db.connect();
    try {
      await client.query("BEGIN");
      const attemptResult=await client.query<Attempt>(
        `SELECT id,case_id::text AS "caseId",play_on::text AS "playOn",
          ARRAY(SELECT unnest(option_order)::text) AS "optionOrder",
          ARRAY(SELECT unnest(selected_suspect_ids)::text) AS "selectedIds",
          lives_remaining AS "livesRemaining",hints_revealed AS "hintsRevealed",status,reward_acorns AS "rewardAcorns"
         FROM detective_daily_attempts WHERE user_id=$1::uuid AND play_on=$2::date FOR UPDATE`,[user.id,today],
      );
      const attempt=attemptResult.rows[0];
      if (!attempt || attempt.status !== "active") { await client.query("ROLLBACK"); return errorResponse("오늘의 추리는 이미 끝났어요. 내일 새로운 사건을 만나보세요.",409); }
      if (!attempt.optionOrder.includes(suspectId)) { await client.query("ROLLBACK"); return errorResponse("오늘 사건의 선택지가 아닙니다.",409); }
      if (attempt.selectedIds.includes(suspectId)) { await client.query("ROLLBACK"); return errorResponse("이미 확인한 결론입니다.",409); }
      const suspect=await client.query<{ correct:boolean;name:string }>(
        `SELECT is_correct AS correct,name FROM detective_case_suspects WHERE id=$1::bigint AND case_id=$2::bigint`,[suspectId,attempt.caseId],
      );
      if (!suspect.rows[0]) { await client.query("ROLLBACK"); return errorResponse("수사 결론을 찾을 수 없습니다.",404); }

      const correct=suspect.rows[0].correct;
      const lives=correct ? attempt.livesRemaining : attempt.livesRemaining-1;
      const status=correct ? "solved" : lives===0 ? "failed" : "active";
      const hints=Math.min(3,attempt.hintsRevealed+(correct ? 0 : 1));
      const promisedReward=correct ? (attempt.livesRemaining===3 ? 5 : attempt.livesRemaining===2 ? 3 : 2) : status==="failed" ? 1 : 0;
      let reward=0;
      let walletFull=false;
      if (promisedReward>0) {
        await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
        const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[user.id]);
        reward=Math.max(0,Math.min(promisedReward,9999-(wallet.rows[0]?.balance || 0)));
        walletFull=reward<promisedReward;
        if (reward>0) {
          await client.query(`UPDATE acorn_wallets SET balance=balance+$2,lifetime_earned=lifetime_earned+$2,updated_at=now() WHERE user_id=$1`,[user.id,reward]);
          await client.query(
            `INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description)
             VALUES($1,$2,'detective_reward',$3,$4)`,[user.id,reward,today,correct ? "다담 추리방 사건 해결" : "다담 추리방 도전 보상"],
          );
        }
      }
      await client.query(
        `UPDATE detective_daily_attempts SET selected_suspect_ids=array_append(selected_suspect_ids,$2::bigint),
          lives_remaining=$3,hints_revealed=$4,status=$5,reward_acorns=$6,
          completed_at=CASE WHEN $5='active' THEN NULL ELSE now() END,updated_at=now() WHERE id=$1`,
        [attempt.id,suspectId,lives,hints,status,reward],
      );
      const newHint=!correct ? await client.query<{ content:string }>(
        `SELECT content FROM detective_case_hints WHERE case_id=$1::bigint AND hint_order=$2`,[attempt.caseId,hints],
      ) : null;
      const reveal=status!=="active" ? await client.query<{ explanation:string;correctName:string }>(
        `SELECT cases.explanation,suspects.name AS "correctName" FROM detective_cases cases
         JOIN detective_case_suspects suspects ON suspects.case_id=cases.id AND suspects.is_correct WHERE cases.id=$1`,[attempt.caseId],
      ) : null;
      await client.query("COMMIT");
      return jsonResponse({
        correct,status,livesRemaining:lives,hintsRevealed:hints,newHint:newHint?.rows[0]?.content || null,
        reward,walletFull,explanation:reveal?.rows[0]?.explanation || null,correctName:reveal?.rows[0]?.correctName || null,
      });
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch(error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("추리방에 입장하려면 로그인이 필요합니다.",401);
    console.error("[detective] failed to submit",error);
    return errorResponse("추리 결과를 확인하지 못했습니다.",500);
  }
}

async function ensureAttempt(userId:string,today:string) {
  await query(
    `WITH selected_case AS (
       SELECT id FROM detective_cases WHERE enabled
       ORDER BY case_no OFFSET (($2::date-DATE '2026-01-01') % GREATEST((SELECT count(*)::int FROM detective_cases WHERE enabled),1)) LIMIT 1
     ), ordered AS (
       SELECT selected_case.id AS case_id,array_agg(suspects.id ORDER BY md5(suspects.id::text || $1::text || $2::text)) AS option_order
       FROM selected_case JOIN detective_case_suspects suspects ON suspects.case_id=selected_case.id GROUP BY selected_case.id
     )
     INSERT INTO detective_daily_attempts(user_id,case_id,play_on,option_order)
     SELECT $1::uuid,case_id,$2::date,option_order FROM ordered WHERE cardinality(option_order)=10
     ON CONFLICT(user_id,play_on) DO NOTHING`,[userId,today],
  );
}

async function loadGame(userId:string,today:string) {
  const attemptResult=await query<Attempt>(
    `SELECT id,case_id::text AS "caseId",play_on::text AS "playOn",
      ARRAY(SELECT unnest(option_order)::text) AS "optionOrder",
      ARRAY(SELECT unnest(selected_suspect_ids)::text) AS "selectedIds",
      lives_remaining AS "livesRemaining",hints_revealed AS "hintsRevealed",status,reward_acorns AS "rewardAcorns"
     FROM detective_daily_attempts WHERE user_id=$1::uuid AND play_on=$2::date`,[userId,today],
  );
  const attempt=attemptResult.rows[0];
  if (!attempt) throw new Error("DETECTIVE_CASE_NOT_READY");
  const [caseResult,suspects,hints,wallet]=await Promise.all([
    query<{ caseNo:number;title:string;briefing:string;question:string;difficulty:number;explanation:string;correctName:string }>(
      `SELECT cases.case_no AS "caseNo",cases.title,cases.briefing,cases.question,cases.difficulty,cases.explanation,
        (SELECT name FROM detective_case_suspects WHERE case_id=cases.id AND is_correct) AS "correctName"
       FROM detective_cases cases WHERE cases.id=$1`,[attempt.caseId],
    ),
    query<{ id:string;name:string;statement:string;selected:boolean }>(
      `SELECT id::text,name,statement,(id=ANY($2::bigint[])) AS selected FROM detective_case_suspects
       WHERE case_id=$1::bigint ORDER BY array_position($3::bigint[],id)`,[attempt.caseId,attempt.selectedIds,attempt.optionOrder],
    ),
    query<{ order:number;content:string }>(
      `SELECT hint_order AS "order",content FROM detective_case_hints WHERE case_id=$1::bigint AND hint_order<=$2 ORDER BY hint_order`,[attempt.caseId,attempt.hintsRevealed],
    ),
    query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1`,[userId]),
  ]);
  const current=caseResult.rows[0];
  const terminal=attempt.status!=="active";
  return {
    case:{ caseNo:current.caseNo,title:current.title,briefing:current.briefing,question:current.question,difficulty:current.difficulty },
    suspects:suspects.rows,hints:hints.rows,playOn:attempt.playOn,livesRemaining:attempt.livesRemaining,
    hintsRevealed:attempt.hintsRevealed,status:attempt.status,reward:attempt.rewardAcorns,walletBalance:wallet.rows[0]?.balance || 0,
    explanation:terminal ? current.explanation : null,correctName:terminal ? current.correctName : null,
  };
}

export function OPTIONS() { return corsPreflightResponse(); }
