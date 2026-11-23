import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { BOUNTY_AMOUNTS, DAILY_FREE_ACORN_LIMIT } from "@/lib/acorn-economy";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const FREE_REWARD_TYPES=["attendance","attendance_bonus","challenge_complete","mission_complete","detective_reward"];

export async function GET(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    await query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
    const [wallet,daily,reputation]=await Promise.all([
      query<{ balance:number;lifetimeEarned:number;lifetimeSpent:number }>(
        `SELECT balance,lifetime_earned AS "lifetimeEarned",lifetime_spent AS "lifetimeSpent" FROM acorn_wallets WHERE user_id=$1`,[user.id],
      ),
      query<{ earned:number }>(
        `SELECT COALESCE(sum(amount),0)::int AS earned FROM acorn_transactions
          WHERE user_id=$1 AND amount>0 AND transaction_type=ANY($2::text[])
            AND created_at >= (((now() AT TIME ZONE 'Asia/Seoul')::date)::timestamp AT TIME ZONE 'Asia/Seoul')
            AND created_at < ((((now() AT TIME ZONE 'Asia/Seoul')::date+1))::timestamp AT TIME ZONE 'Asia/Seoul')`,[user.id,FREE_REWARD_TYPES],
      ),
      query<{ score:number;acceptedAnswers:number }>(
        `SELECT score,accepted_answers AS "acceptedAnswers" FROM user_help_reputation WHERE user_id=$1`,[user.id],
      ),
    ]);
    const dailyEarned=Math.max(0,daily.rows[0]?.earned || 0);
    return jsonResponse({
      wallet:wallet.rows[0] || { balance:0,lifetimeEarned:0,lifetimeSpent:0 },
      dailyFreeEarned:dailyEarned,
      dailyFreeLimit:DAILY_FREE_ACORN_LIMIT,
      dailyFreeRemaining:Math.max(0,DAILY_FREE_ACORN_LIMIT-dailyEarned),
      bountyAmounts:[...BOUNTY_AMOUNTS],
      bountyFeePercent:10,
      helpReputation:reputation.rows[0] || { score:0,acceptedAnswers:0 },
    });
  } catch(error) {
    if (error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    console.error("[acorn-economy] failed to load",error);
    return errorResponse("도토리 경제 정보를 불러오지 못했습니다.",500);
  }
}

export function OPTIONS(){return corsPreflightResponse();}
