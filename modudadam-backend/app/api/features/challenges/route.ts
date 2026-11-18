import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const kstDate = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
type ChallengeRow = { id:string;slug:string;title:string;description:string;icon:string;categoryName:string;goalDays:number;periodDays:number;dailyAcorns:number;completionAcorns:number;participantCount:number;enrollmentId:string|null;startedOn:string|null;endsOn:string|null;enrollmentStatus:string|null;checkinCount:number;checkedToday:boolean };

export async function GET(request:NextRequest) {
  try {
    const user = await getSessionUser(request);
    const result = await query<ChallengeRow>(
      `SELECT challenges.id,challenges.slug,challenges.title,challenges.description,challenges.icon,
        challenges.category_name AS "categoryName",challenges.goal_days AS "goalDays",challenges.period_days AS "periodDays",
        challenges.daily_acorns AS "dailyAcorns",challenges.completion_acorns AS "completionAcorns",
        (SELECT count(*)::int FROM challenge_enrollments all_enrollments WHERE all_enrollments.challenge_id=challenges.id) AS "participantCount",
        enrollment.id AS "enrollmentId",enrollment.started_on::text AS "startedOn",enrollment.ends_on::text AS "endsOn",enrollment.status AS "enrollmentStatus",
        COALESCE(progress.checkin_count,0)::int AS "checkinCount",COALESCE(progress.checked_today,false) AS "checkedToday"
       FROM dadam_challenges challenges
       LEFT JOIN challenge_enrollments enrollment ON enrollment.challenge_id=challenges.id AND enrollment.user_id=$1::uuid
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS checkin_count,bool_or(checkin_on=(now() AT TIME ZONE 'Asia/Seoul')::date) AS checked_today
         FROM challenge_checkins WHERE enrollment_id=enrollment.id
       ) progress ON true
       WHERE challenges.status='published' ORDER BY challenges.sort_order,challenges.created_at`,
      [user?.id || null],
    );
    const wallet = user ? await query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1`,[user.id]) : null;
    return jsonResponse({ challenges:result.rows,walletBalance:wallet?.rows[0]?.balance || 0 });
  } catch { return errorResponse("다담 챌린지를 불러오지 못했습니다.",500); }
}

export async function POST(request:NextRequest) {
  try {
    const user = await requireSessionUser(request); const body = await request.json();
    if (body.action === "join") return joinChallenge(user.id,String(body.challengeId || ""));
    if (body.action === "checkin") return checkIn(user.id,String(body.enrollmentId || ""),String(body.note || "").trim());
    return errorResponse("요청 내용을 확인해 주세요.");
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("챌린지 요청을 처리하지 못했습니다.",500);
  }
}

async function joinChallenge(userId:string,challengeId:string) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return errorResponse("챌린지를 확인해 주세요.");
  const today = kstDate();
  const result = await query<{ id:string }>(
    `INSERT INTO challenge_enrollments(challenge_id,user_id,started_on,ends_on)
     SELECT id,$2,$3::date,$3::date+(period_days-1) FROM dadam_challenges WHERE id=$1 AND status='published'
     ON CONFLICT(challenge_id,user_id) DO NOTHING RETURNING id`,
    [challengeId,userId,today],
  );
  if (!result.rows[0]) return errorResponse("이미 참여했거나 참여할 수 없는 챌린지입니다.",409);
  return jsonResponse({ enrollmentId:result.rows[0].id },{ status:201 });
}

async function checkIn(userId:string,enrollmentId:string,note:string) {
  if (!/^[0-9a-f-]{36}$/i.test(enrollmentId)) return errorResponse("참여 정보를 확인해 주세요.");
  if (note.length < 10 || note.length > 160) return errorResponse("오늘 실천한 내용을 10~160자로 기록해 주세요.");
  const client = await db.connect(); const today = kstDate();
  try {
    await client.query("BEGIN");
    const enrollment = await client.query<{ challengeId:string;title:string;goalDays:number;dailyAcorns:number;completionAcorns:number;status:string;endsOn:string }>(
      `SELECT enrollment.challenge_id AS "challengeId",challenges.title,challenges.goal_days AS "goalDays",challenges.daily_acorns AS "dailyAcorns",challenges.completion_acorns AS "completionAcorns",enrollment.status,enrollment.ends_on::text AS "endsOn"
       FROM challenge_enrollments enrollment JOIN dadam_challenges challenges ON challenges.id=enrollment.challenge_id
       WHERE enrollment.id=$1 AND enrollment.user_id=$2 FOR UPDATE`,[enrollmentId,userId]);
    const item = enrollment.rows[0];
    if (!item) { await client.query("ROLLBACK"); return errorResponse("참여 중인 챌린지를 찾을 수 없습니다.",404); }
    if (item.status !== "active" || item.endsOn < today) { if (item.status === "active") await client.query(`UPDATE challenge_enrollments SET status='expired' WHERE id=$1`,[enrollmentId]); await client.query("COMMIT"); return errorResponse("인증 기간이 끝난 챌린지입니다.",409); }
    const count = await client.query<{ count:number }>(`SELECT count(*)::int AS count FROM challenge_checkins WHERE enrollment_id=$1`,[enrollmentId]);
    const nextCount = count.rows[0].count + 1; const completed = nextCount >= item.goalDays; const requestedReward = item.dailyAcorns + (completed ? item.completionAcorns : 0);
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[userId]);
    const reward=Math.max(0,Math.min(requestedReward,9999-(wallet.rows[0]?.balance || 0)));
    const inserted = await client.query(`INSERT INTO challenge_checkins(enrollment_id,checkin_on,note,acorns_earned) VALUES($1,$2::date,$3,$4) ON CONFLICT(enrollment_id,checkin_on) DO NOTHING RETURNING id`,[enrollmentId,today,note || null,reward]);
    if (!inserted.rows[0]) { await client.query("ROLLBACK"); return errorResponse("오늘 인증은 이미 완료했어요.",409); }
    if (reward > 0) {
      await client.query(`UPDATE acorn_wallets SET balance=balance+$2,lifetime_earned=lifetime_earned+$2,updated_at=now() WHERE user_id=$1`,[userId,reward]);
      await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES($1,$2,'challenge_complete',$3,$4)`,[userId,reward,`${enrollmentId}:${today}`,`${item.title} 완료 보상`]);
    }
    if (completed) await client.query(`UPDATE challenge_enrollments SET status='completed',completed_at=now() WHERE id=$1`,[enrollmentId]);
    await client.query("COMMIT"); return jsonResponse({ reward,completed,checkinCount:nextCount });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export function OPTIONS() { return corsPreflightResponse(); }
