import type { PoolClient } from "pg";

export const ACORN_WALLET_LIMIT = 20_000;
export const DAILY_FREE_ACORN_LIMIT = 5;
export const BOUNTY_AMOUNTS = [100,200,300] as const;

const FREE_REWARD_TYPES = [
  "attendance",
  "attendance_bonus",
  "challenge_complete",
  "mission_complete",
  "detective_reward",
] as const;

type FreeRewardType = typeof FREE_REWARD_TYPES[number];

export async function grantLimitedAcorns(
  client: PoolClient,
  input: {
    userId: string;
    requestedAmount: number;
    transactionType: FreeRewardType;
    referenceId: string;
    description: string;
  },
) {
  await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[input.userId]);
  const wallet=await client.query<{ balance:number }>(
    `SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[input.userId],
  );
  const duplicate=await client.query<{ amount:number }>(
    `SELECT amount FROM acorn_transactions
      WHERE user_id=$1 AND transaction_type=$2 AND reference_id=$3 LIMIT 1`,
    [input.userId,input.transactionType,input.referenceId],
  );
  const daily=await client.query<{ earned:number }>(
    `SELECT COALESCE(sum(amount),0)::int AS earned
       FROM acorn_transactions
      WHERE user_id=$1 AND amount>0 AND transaction_type=ANY($2::text[])
        AND created_at >= (((now() AT TIME ZONE 'Asia/Seoul')::date)::timestamp AT TIME ZONE 'Asia/Seoul')
        AND created_at < ((((now() AT TIME ZONE 'Asia/Seoul')::date+1))::timestamp AT TIME ZONE 'Asia/Seoul')`,
    [input.userId,[...FREE_REWARD_TYPES]],
  );
  const currentBalance=wallet.rows[0]?.balance || 0;
  const alreadyEarned=Math.max(0,daily.rows[0]?.earned || 0);
  if (duplicate.rows[0]) return {
    granted:0,
    balance:currentBalance,
    dailyEarned:alreadyEarned,
    dailyRemaining:Math.max(0,DAILY_FREE_ACORN_LIMIT-alreadyEarned),
    duplicate:true,
  };
  const requested=Math.max(0,Math.floor(input.requestedAmount));
  const granted=Math.max(0,Math.min(
    requested,
    DAILY_FREE_ACORN_LIMIT-alreadyEarned,
    ACORN_WALLET_LIMIT-currentBalance,
  ));
  if (granted>0) {
    await client.query(
      `UPDATE acorn_wallets
          SET balance=balance+$2,lifetime_earned=lifetime_earned+$2,updated_at=now()
        WHERE user_id=$1`,[input.userId,granted],
    );
    await client.query(
      `INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description)
       VALUES($1,$2,$3,$4,$5)`,
      [input.userId,granted,input.transactionType,input.referenceId,input.description],
    );
  }
  return {
    granted,
    balance:currentBalance+granted,
    dailyEarned:alreadyEarned+granted,
    dailyRemaining:Math.max(0,DAILY_FREE_ACORN_LIMIT-alreadyEarned-granted),
    duplicate:false,
  };
}

export function normalizeBountyAmount(value: unknown) {
  const amount=Number(value || 0);
  return BOUNTY_AMOUNTS.includes(amount as typeof BOUNTY_AMOUNTS[number]) ? amount : amount===0 ? 0 : null;
}
