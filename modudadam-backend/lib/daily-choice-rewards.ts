import { db } from "@/lib/db";

const kstDate = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());

type DueChoice = { id:string;activeOn:string };
type OptionCount = { optionId:string;voteCount:number };

export async function settleDueChoiceRewards() {
  const client=await db.connect();
  const today=kstDate();
  let settledChoices=0;let rewardedUsers=0;
  try {
    await client.query("BEGIN");
    const due=await client.query<DueChoice>(
      `SELECT choices.id,choices.active_on::text AS "activeOn"
       FROM daily_choices choices
       WHERE choices.status='published' AND choices.active_on<$1::date
         AND NOT EXISTS(SELECT 1 FROM daily_choice_reward_batches batches WHERE batches.choice_id=choices.id)
       ORDER BY choices.active_on
       FOR UPDATE OF choices SKIP LOCKED`,[today],
    );
    for (const choice of due.rows) {
      const counts=await client.query<OptionCount>(
        `SELECT options.id AS "optionId",count(votes.user_id)::int AS "voteCount"
         FROM daily_choice_options options
         LEFT JOIN daily_choice_votes votes ON votes.choice_id=options.choice_id AND votes.option_id=options.id
         WHERE options.choice_id=$1
         GROUP BY options.id,options.sort_order ORDER BY options.sort_order`,[choice.id],
      );
      const participantCount=counts.rows.reduce((sum,row)=>sum+row.voteCount,0);
      const highest=counts.rows.length ? Math.max(...counts.rows.map((row)=>row.voteCount)) : 0;
      const leaders=highest>0 ? counts.rows.filter((row)=>row.voteCount===highest) : [];
      const isTie=leaders.length>1;
      const winnerOptionId=leaders.length===1 ? leaders[0].optionId : null;
      const batch=await client.query(
        `INSERT INTO daily_choice_reward_batches(choice_id,choice_on,winner_option_id,is_tie,participant_count)
         VALUES($1,$2::date,$3::uuid,$4,$5) ON CONFLICT(choice_id) DO NOTHING RETURNING choice_id`,
        [choice.id,choice.activeOn,winnerOptionId,isTie,participantCount],
      );
      if (!batch.rows[0]) continue;
      settledChoices++;
      if (!participantCount) continue;
      const rewards=await client.query(
        `WITH reward_rows AS (
           SELECT votes.user_id,votes.option_id,
             CASE WHEN $2::uuid IS NULL THEN 'tie' WHEN votes.option_id=$2::uuid THEN 'winner' ELSE 'loser' END AS outcome,
             CASE WHEN $2::uuid IS NOT NULL AND votes.option_id=$2::uuid THEN 20 ELSE 10 END AS reward_amount,
             md5($1::text||':'||votes.user_id::text)::uuid AS request_key
           FROM daily_choice_votes votes WHERE votes.choice_id=$1::uuid
         ), inserted_gifts AS (
           INSERT INTO acorn_gifts(sender_id,recipient_id,amount,message,request_key,gift_type,status,sender_display_name,sent_at)
           SELECT NULL,user_id,reward_amount,
             CASE outcome WHEN 'winner' THEN '극한 밸런스 다수 선택 보상! 도토리 20개를 받았어요.' WHEN 'tie' THEN '극한 밸런스 동률 참여 보상! 도토리 10개를 받았어요.' ELSE '극한 밸런스 참여 보상! 도토리 10개를 받았어요.' END,
             request_key,'choice_reward','sent','modudadam',now()
           FROM reward_rows
           ON CONFLICT(recipient_id,request_key) WHERE gift_type='choice_reward'
           DO UPDATE SET message=EXCLUDED.message
           RETURNING id,recipient_id,request_key
         )
         INSERT INTO daily_choice_rewards(choice_id,user_id,option_id,outcome,reward_amount,gift_id)
         SELECT $1::uuid,rewards.user_id,rewards.option_id,rewards.outcome,rewards.reward_amount,gifts.id
         FROM reward_rows rewards JOIN inserted_gifts gifts ON gifts.recipient_id=rewards.user_id AND gifts.request_key=rewards.request_key
         ON CONFLICT(choice_id,user_id) DO NOTHING RETURNING user_id`,[choice.id,winnerOptionId],
      );
      rewardedUsers+=rewards.rowCount || 0;
    }
    await client.query("COMMIT");
    return { settledChoices,rewardedUsers,today };
  } catch(error) { await client.query("ROLLBACK");throw error; } finally { client.release(); }
}
