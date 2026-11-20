import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const weekStartSql = `(date_trunc('week',timezone('Asia/Seoul',now())))::date`;

type RankingRow = { userId:string;nickname:string;stampEmoji:string|null;score:number;voteCount?:number };

export async function GET(request:NextRequest) {
  try {
    await finalizePastWeeks();
    const viewer=await getSessionUser(request);
    const [kindness,misdeed,myVote,points]=await Promise.all([
      query<RankingRow>(
        `SELECT users.id AS "userId",users.nickname,user_stamp_emoji(users.id) AS "stampEmoji",count(*)::int AS score
         FROM acorn_gifts gifts JOIN users ON users.id=gifts.sender_id
         WHERE gifts.created_at >= (${weekStartSql}::timestamp AT TIME ZONE 'Asia/Seoul')
           AND gifts.gift_type='user' AND gifts.status IN ('sent','viewed','claimed')
         GROUP BY users.id,users.nickname ORDER BY score DESC,max(gifts.created_at) ASC LIMIT 5`),
      currentMisdeedCandidates(),
      viewer ? query<{ candidateUserId:string }>(`SELECT candidate_user_id AS "candidateUserId" FROM weekly_misdeed_votes WHERE week_start=${weekStartSql} AND voter_id=$1`,[viewer.id]) : Promise.resolve({ rows:[] }),
      viewer ? query<{ kindnessPoints:number;misdeedPoints:number }>(`SELECT kindness_points AS "kindnessPoints",misdeed_points AS "misdeedPoints" FROM user_reputation_points WHERE user_id=$1`,[viewer.id]) : Promise.resolve({ rows:[] }),
    ]);
    return jsonResponse({
      weekStart:null,
      kindness:kindness.rows,
      misdeed:misdeed.rows,
      myVoteCandidateId:myVote.rows[0]?.candidateUserId || null,
      myPoints:points.rows[0] || null,
      votingEnabled:Boolean(viewer),
    });
  } catch(error) {
    console.error("[reputation-rankings] failed to load",error);
    return errorResponse("주간 선행·주의 랭킹을 불러오지 못했습니다.",500);
  }
}

export async function POST(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    const candidateUserId=String((await request.json()).candidateUserId || "");
    if (!/^[0-9a-f-]{36}$/i.test(candidateUserId)) return errorResponse("투표할 후보를 확인해 주세요.");
    if (candidateUserId===user.id) return errorResponse("본인에게는 투표할 수 없습니다.",409);
    const candidates=await currentMisdeedCandidates();
    if (!candidates.rows.some((candidate) => candidate.userId===candidateUserId)) return errorResponse("이번 주 투표 후보가 아닙니다.",409);
    const inserted=await query(`INSERT INTO weekly_misdeed_votes(week_start,voter_id,candidate_user_id) VALUES(${weekStartSql},$1,$2) ON CONFLICT(week_start,voter_id) DO NOTHING RETURNING voter_id`,[user.id,candidateUserId]);
    if (!inserted.rows[0]) return errorResponse("이번 주 투표는 이미 완료했어요.",409);
    return jsonResponse({ voted:true,candidateUserId },{ status:201 });
  } catch(error) {
    if (error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    console.error("[reputation-rankings] failed to vote",error);
    return errorResponse("투표를 완료하지 못했습니다.",500);
  }
}

function currentMisdeedCandidates() {
  return query<RankingRow>(
    `WITH valid_reports AS (
       SELECT COALESCE(posts.author_id,comments.author_id) AS user_id
       FROM content_reports reports
       LEFT JOIN posts ON reports.target_type='post' AND posts.id=reports.post_id
       LEFT JOIN comments ON reports.target_type='comment' AND comments.id=reports.comment_id
       WHERE reports.status='actioned'
         AND reports.reviewed_at >= (${weekStartSql}::timestamp AT TIME ZONE 'Asia/Seoul')
     ), candidates AS (
       SELECT user_id,count(*)::int AS score FROM valid_reports WHERE user_id IS NOT NULL GROUP BY user_id ORDER BY score DESC,user_id LIMIT 5
     )
     SELECT users.id AS "userId",users.nickname,user_stamp_emoji(users.id) AS "stampEmoji",candidates.score,
       count(votes.voter_id)::int AS "voteCount"
     FROM candidates JOIN users ON users.id=candidates.user_id
     LEFT JOIN weekly_misdeed_votes votes ON votes.week_start=${weekStartSql} AND votes.candidate_user_id=users.id
     WHERE users.status='active' AND users.deleted_at IS NULL
     GROUP BY users.id,users.nickname,candidates.score
     ORDER BY candidates.score DESC,"voteCount" DESC,users.id`);
}

async function finalizePastWeeks() {
  const weeks=await query<{ weekStart:string }>(`SELECT DISTINCT week_start::text AS "weekStart" FROM weekly_misdeed_votes WHERE week_start<${weekStartSql} AND NOT EXISTS(SELECT 1 FROM weekly_misdeed_awards awards WHERE awards.week_start=weekly_misdeed_votes.week_start)`);
  for (const item of weeks.rows) {
    const client=await db.connect();
    try {
      await client.query("BEGIN");
      const ranked=await client.query<{ userId:string;voteCount:number;rank:number }>(`SELECT candidate_user_id AS "userId",count(*)::int AS "voteCount",row_number() OVER(ORDER BY count(*) DESC,candidate_user_id)::int AS rank FROM weekly_misdeed_votes WHERE week_start=$1::date GROUP BY candidate_user_id ORDER BY rank LIMIT 5`,[item.weekStart]);
      for (const row of ranked.rows) {
        const points=Math.min(5,Math.max(1,row.rank));
        const award=await client.query(`INSERT INTO weekly_misdeed_awards(week_start,user_id,final_rank,vote_count,points_awarded) VALUES($1::date,$2,$3,$4,$5) ON CONFLICT(week_start,user_id) DO NOTHING RETURNING user_id`,[item.weekStart,row.userId,row.rank,row.voteCount,points]);
        if (!award.rows[0]) continue;
        await client.query(`INSERT INTO reputation_point_ledger(user_id,point_type,amount,source_type,source_key,description) VALUES($1,'misdeed',$2,'weekly_misdeed_vote',$3,$4) ON CONFLICT DO NOTHING`,[row.userId,points,`${item.weekStart}:${row.userId}`,`${item.weekStart} 주간 주의 랭킹 ${row.rank}위`]);
        await client.query(`INSERT INTO user_reputation_points(user_id,misdeed_points) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET misdeed_points=LEAST(20000,user_reputation_points.misdeed_points+$2),updated_at=now()`,[row.userId,points]);
      }
      await client.query("COMMIT");
    } catch(error) { await client.query("ROLLBACK");throw error; } finally { client.release(); }
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
