import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const kstDate = () => {
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{ timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).formatToParts(new Date()).map(({ type,value }) => [type,value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

type Attempt = {
  id:string;caseId:string;playOn:string;optionOrder:string[];selectedIds:string[];livesRemaining:number;
  hintsRevealed:number;status:"active"|"solved"|"failed";rewardAcorns:number;
};

export async function GET(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    const today=kstDate();
    await ensureAttempt(user.id,today);
    if (request.nextUrl.searchParams.get("reshuffle")==="1") await reshuffleOptions(user.id,today);
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
    const body=await request.json() as { action?:unknown;suspectId?:unknown };
    const action=String(body.action || "accuse");
    if (action==="reveal_hint") return await revealHint(user.id);
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
      const suspect=await client.query<{ correct:boolean }>(
        `SELECT is_correct AS correct FROM detective_case_suspects WHERE id=$1::bigint AND case_id=$2::bigint`,[suspectId,attempt.caseId],
      );
      if (!suspect.rows[0]) { await client.query("ROLLBACK"); return errorResponse("수사 결론을 찾을 수 없습니다.",404); }

      const correct=suspect.rows[0].correct;
      const lives=correct ? attempt.livesRemaining : attempt.livesRemaining-1;
      const status=correct ? "solved" : lives===0 ? "failed" : "active";
      const hints=attempt.hintsRevealed;
      const promisedReward=correct ? detectiveReward(attempt.livesRemaining) : status==="failed" ? 1 : 0;
      let reward=0;
      let walletFull=false;
      if (promisedReward>0) {
        await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
        const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[user.id]);
        reward=Math.max(0,Math.min(promisedReward,20000-(wallet.rows[0]?.balance || 0)));
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
      const reveal=status!=="active" ? await client.query<{ explanation:string }>(
        `SELECT explanation FROM detective_cases WHERE id=$1`,[attempt.caseId],
      ) : null;
      await client.query("COMMIT");
      return jsonResponse({
        correct,status,livesRemaining:lives,hintsRevealed:hints,
        reward,rewardPreview:status==="active" ? detectiveReward(lives) : reward,walletFull,
        explanation:reveal?.rows[0]?.explanation || null,
      });
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch(error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("추리방에 입장하려면 로그인이 필요합니다.",401);
    console.error("[detective] failed to submit",error);
    return errorResponse("추리 결과를 확인하지 못했습니다.",500);
  }
}

async function revealHint(userId:string) {
  const today=kstDate();
  await ensureAttempt(userId,today);
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const result=await client.query<Attempt>(
      `SELECT id,case_id::text AS "caseId",play_on::text AS "playOn",
        ARRAY(SELECT unnest(option_order)::text) AS "optionOrder",
        ARRAY(SELECT unnest(selected_suspect_ids)::text) AS "selectedIds",
        lives_remaining AS "livesRemaining",hints_revealed AS "hintsRevealed",status,reward_acorns AS "rewardAcorns"
       FROM detective_daily_attempts WHERE user_id=$1::uuid AND play_on=$2::date FOR UPDATE`,[userId,today],
    );
    const attempt=result.rows[0];
    if (!attempt || attempt.status!=="active") { await client.query("ROLLBACK");return errorResponse("진행 중인 사건에서만 단서를 확인할 수 있어요.",409); }
    if (attempt.hintsRevealed>=3) { await client.query("ROLLBACK");return errorResponse("오늘의 단서를 모두 확인했어요.",409); }
    const nextOrder=attempt.hintsRevealed+1;
    const hint=await client.query<{ content:string }>(
      `SELECT content FROM detective_case_hints WHERE case_id=$1::bigint AND hint_order=$2`,[attempt.caseId,nextOrder],
    );
    if (!hint.rows[0]) { await client.query("ROLLBACK");return errorResponse("확인할 단서가 준비되지 않았어요.",404); }
    await client.query(`UPDATE detective_daily_attempts SET hints_revealed=$2,updated_at=now() WHERE id=$1`,[attempt.id,nextOrder]);
    await client.query("COMMIT");
    return jsonResponse({ order:nextOrder,content:hint.rows[0].content,hintsRemaining:3-nextOrder });
  } catch(error) { await client.query("ROLLBACK");throw error; } finally { client.release(); }
}

async function ensureAttempt(userId:string,today:string) {
  await query(
    `WITH playable_cases AS (
       SELECT cases.id,cases.case_no
       FROM detective_cases cases
       WHERE cases.enabled
         AND (SELECT count(*) FROM detective_case_suspects suspects WHERE suspects.case_id=cases.id)=10
         AND (SELECT count(*) FROM detective_case_suspects suspects WHERE suspects.case_id=cases.id AND suspects.is_correct)=1
         AND (SELECT count(*) FROM detective_case_hints hints WHERE hints.case_id=cases.id)=3
     ), selected_case AS (
       SELECT playable.id
       FROM playable_cases playable
       ORDER BY
         CASE WHEN EXISTS(
           SELECT 1 FROM detective_daily_attempts history
           WHERE history.user_id=$1::uuid
             AND history.play_on<$2::date
             AND history.case_id=playable.id
         ) THEN 1 ELSE 0 END,
         CASE WHEN EXISTS(
           SELECT 1 FROM detective_daily_attempts yesterday
           WHERE yesterday.user_id=$1::uuid
             AND yesterday.play_on=$2::date-1
             AND yesterday.case_id=playable.id
         ) THEN 1 ELSE 0 END,
         md5(playable.id::text || ':' || $2::text)
       LIMIT 1
     ), ordered AS (
       SELECT selected_case.id AS case_id,array_agg(suspects.id ORDER BY random()) AS option_order
       FROM selected_case JOIN detective_case_suspects suspects ON suspects.case_id=selected_case.id GROUP BY selected_case.id
     )
     INSERT INTO detective_daily_attempts AS current_attempt(
       user_id,case_id,play_on,option_order,selected_suspect_ids,
       lives_remaining,hints_revealed,status,reward_acorns,completed_at
     )
     SELECT $1::uuid,case_id,$2::date,option_order,'{}'::bigint[],3,0,'active',0,NULL
     FROM ordered WHERE cardinality(option_order)=10
     ON CONFLICT(user_id,play_on) DO UPDATE SET
       case_id=EXCLUDED.case_id,
       option_order=EXCLUDED.option_order,
       selected_suspect_ids='{}'::bigint[],
       lives_remaining=3,
       hints_revealed=0,
       status='active',
       reward_acorns=0,
       completed_at=NULL,
       updated_at=now()
     WHERE current_attempt.case_id<>EXCLUDED.case_id
       AND EXISTS(
         SELECT 1 FROM detective_daily_attempts history
         WHERE history.user_id=$1::uuid
           AND history.play_on<$2::date
           AND history.case_id=current_attempt.case_id
       )`,[userId,today],
  );
}

async function reshuffleOptions(userId:string,today:string) {
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const result=await client.query<{ optionOrder:string[] }>(
      `SELECT ARRAY(SELECT unnest(option_order)::text) AS "optionOrder"
       FROM detective_daily_attempts
       WHERE user_id=$1::uuid AND play_on=$2::date AND status='active'
       FOR UPDATE`,
      [userId,today],
    );
    const optionOrder=result.rows[0]?.optionOrder;
    if (optionOrder && optionOrder.length>1) {
      const nextOrder=[...optionOrder];
      for (let index=nextOrder.length-1;index>0;index-=1) {
        const swapIndex=Math.floor(Math.random()*index);
        [nextOrder[index],nextOrder[swapIndex]]=[nextOrder[swapIndex],nextOrder[index]];
      }
      await client.query(
        `UPDATE detective_daily_attempts SET option_order=$3::bigint[],updated_at=now()
         WHERE user_id=$1::uuid AND play_on=$2::date`,
        [userId,today,nextOrder],
      );
    }
    await client.query("COMMIT");
  } catch(error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
    query<{ title:string;briefing:string;question:string;difficulty:number;explanation:string }>(
      `SELECT title,briefing,question,difficulty,explanation
       FROM detective_cases WHERE id=$1`,[attempt.caseId],
    ),
    query<{ id:string;statement:string;selected:boolean }>(
      `SELECT id::text,statement,(id=ANY($2::bigint[])) AS selected FROM detective_case_suspects
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
    case:{ title:hideCaseSequence(current.title),briefing:current.briefing,question:current.question,difficulty:current.difficulty },
    suspects:suspects.rows,hints:hints.rows,playOn:attempt.playOn,livesRemaining:attempt.livesRemaining,
    hintsRevealed:attempt.hintsRevealed,hintsRemaining:Math.max(0,3-attempt.hintsRevealed),status:attempt.status,
    reward:attempt.rewardAcorns,rewardPreview:attempt.status==="active" ? detectiveReward(attempt.livesRemaining) : attempt.rewardAcorns,
    walletBalance:wallet.rows[0]?.balance || 0,
    explanation:terminal ? current.explanation : null,
  };
}

function hideCaseSequence(title:string) {
  return title.replace(/^(?:(?:논리\s*)?사건|case)\s*\d+\s*[·:._-]?\s*/i,"").trim() || "오늘의 미스터리";
}

function detectiveReward(livesRemaining:number) {
  return livesRemaining>=3 ? 5 : livesRemaining===2 ? 3 : livesRemaining===1 ? 2 : 1;
}

export function OPTIONS() { return corsPreflightResponse(); }
