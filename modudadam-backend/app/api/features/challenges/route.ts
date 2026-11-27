import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { grantLimitedAcorns } from "@/lib/acorn-economy";

const kstDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",
}).format(new Date());

type VerificationType = "duration"|"quantity"|"duration_choice"|"two_text"|"reading"|"reflection";
type VerificationConfig = {
  amountLabel?:string;unit?:string;min?:number;max?:number;
  detailLabel?:string;detailRequired?:boolean;detailMin?:number;
  choiceLabel?:string;options?:string[];
  subjectLabel?:string;resultLabel?:string;subjectMin?:number;resultMin?:number;
};
type Evidence = { amount?:number;choice?:string;subject?:string;detail?:string };
type ChallengeRow = {
  id:string;slug:string;title:string;description:string;icon:string;categoryName:string;
  goalDays:number;periodDays:number;dailyAcorns:number;completionAcorns:number;
  verificationType:VerificationType;verificationConfig:VerificationConfig;
  participantCount:number;enrollmentId:string|null;startedOn:string|null;endsOn:string|null;
  enrollmentStatus:string|null;roundNo:number|null;checkinCount:number;checkedToday:boolean;
};

export async function GET(request:NextRequest) {
  try {
    const user = await getSessionUser(request);
    const result = await query<ChallengeRow>(
      `SELECT challenges.id,challenges.slug,challenges.title,challenges.description,challenges.icon,
        challenges.category_name AS "categoryName",challenges.goal_days AS "goalDays",challenges.period_days AS "periodDays",
        challenges.daily_acorns AS "dailyAcorns",challenges.completion_acorns AS "completionAcorns",
        challenges.verification_type AS "verificationType",challenges.verification_config AS "verificationConfig",
        (SELECT count(DISTINCT all_enrollments.user_id)::int FROM challenge_enrollments all_enrollments
          WHERE all_enrollments.challenge_id=challenges.id) AS "participantCount",
        enrollment.id AS "enrollmentId",enrollment.started_on::text AS "startedOn",enrollment.ends_on::text AS "endsOn",
        CASE WHEN enrollment.status='active' AND enrollment.ends_on < (now() AT TIME ZONE 'Asia/Seoul')::date
          THEN 'expired' ELSE enrollment.status END AS "enrollmentStatus",
        enrollment.round_no AS "roundNo",
        COALESCE(progress.checkin_count,0)::int AS "checkinCount",COALESCE(progress.checked_today,false) AS "checkedToday"
       FROM dadam_challenges challenges
       LEFT JOIN LATERAL (
         SELECT candidate.* FROM challenge_enrollments candidate
         WHERE candidate.challenge_id=challenges.id AND candidate.user_id=$1::uuid
         ORDER BY (candidate.status='active' AND candidate.ends_on >= (now() AT TIME ZONE 'Asia/Seoul')::date) DESC,
           candidate.created_at DESC
         LIMIT 1
       ) enrollment ON true
       LEFT JOIN LATERAL (
         SELECT count(*)::int AS checkin_count,
           bool_or(checkin_on=(now() AT TIME ZONE 'Asia/Seoul')::date) AS checked_today
         FROM challenge_checkins
         WHERE enrollment_id=enrollment.id AND verification_status='verified'
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
    const user = await requireSessionUser(request);
    const body = await request.json() as Record<string,unknown>;
    if (body.action === "join") return joinChallenge(user.id,String(body.challengeId || ""));
    if (body.action === "checkin") {
      return checkIn(user.id,String(body.enrollmentId || ""),isRecord(body.evidence) ? body.evidence : {});
    }
    return errorResponse("요청 내용을 확인해 주세요.");
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("챌린지 요청을 처리하지 못했습니다.",500);
  }
}

async function joinChallenge(userId:string,challengeId:string) {
  if (!/^[0-9a-f-]{36}$/i.test(challengeId)) return errorResponse("챌린지를 확인해 주세요.");
  const client = await db.connect();
  const today = kstDate();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text,0::bigint))`,[`${challengeId}:${userId}`]);
    const challenge = await client.query<{ periodDays:number }>(
      `SELECT period_days AS "periodDays" FROM dadam_challenges WHERE id=$1 AND status='published'`,[challengeId]);
    if (!challenge.rows[0]) {
      await client.query("ROLLBACK");
      return errorResponse("참여할 수 없는 챌린지입니다.",404);
    }
    await client.query(
      `UPDATE challenge_enrollments SET status='expired'
       WHERE challenge_id=$1 AND user_id=$2 AND status='active' AND ends_on < $3::date`,
      [challengeId,userId,today],
    );
    const active = await client.query(
      `SELECT id FROM challenge_enrollments WHERE challenge_id=$1 AND user_id=$2 AND status='active'`,
      [challengeId,userId],
    );
    if (active.rows[0]) {
      await client.query("ROLLBACK");
      return errorResponse("이미 진행 중인 챌린지입니다.",409);
    }
    const round = await client.query<{ roundNo:number }>(
      `SELECT COALESCE(max(round_no),0)::int+1 AS "roundNo" FROM challenge_enrollments
       WHERE challenge_id=$1 AND user_id=$2`,[challengeId,userId]);
    const result = await client.query<{ id:string;roundNo:number }>(
      `INSERT INTO challenge_enrollments(challenge_id,user_id,started_on,ends_on,round_no)
       VALUES($1,$2,$3::date,$3::date+($4::int-1),$5) RETURNING id,round_no AS "roundNo"`,
      [challengeId,userId,today,challenge.rows[0].periodDays,round.rows[0].roundNo],
    );
    await client.query("COMMIT");
    return jsonResponse({ enrollmentId:result.rows[0].id,roundNo:result.rows[0].roundNo },{ status:201 });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function checkIn(userId:string,enrollmentId:string,rawEvidence:Record<string,unknown>) {
  if (!/^[0-9a-f-]{36}$/i.test(enrollmentId)) return errorResponse("참여 정보를 확인해 주세요.");
  const client = await db.connect();
  const today = kstDate();
  try {
    await client.query("BEGIN");
    const enrollment = await client.query<{
      challengeId:string;title:string;goalDays:number;completionAcorns:number;status:string;endsOn:string;
      verificationType:VerificationType;verificationConfig:VerificationConfig;
    }>(
      `SELECT enrollment.challenge_id AS "challengeId",challenges.title,challenges.goal_days AS "goalDays",
        challenges.completion_acorns AS "completionAcorns",challenges.verification_type AS "verificationType",
        challenges.verification_config AS "verificationConfig",enrollment.status,enrollment.ends_on::text AS "endsOn"
       FROM challenge_enrollments enrollment JOIN dadam_challenges challenges ON challenges.id=enrollment.challenge_id
       WHERE enrollment.id=$1 AND enrollment.user_id=$2 FOR UPDATE`,[enrollmentId,userId]);
    const item = enrollment.rows[0];
    if (!item) {
      await client.query("ROLLBACK");
      return errorResponse("참여 중인 챌린지를 찾을 수 없습니다.",404);
    }
    if (item.status !== "active" || item.endsOn < today) {
      if (item.status === "active") await client.query(`UPDATE challenge_enrollments SET status='expired' WHERE id=$1`,[enrollmentId]);
      await client.query("COMMIT");
      return errorResponse("인증 기간이 끝난 챌린지입니다.",409);
    }
    const validation = validateEvidence(item.verificationType,item.verificationConfig,rawEvidence);
    if (!validation.ok) {
      await client.query("ROLLBACK");
      return errorResponse(validation.message);
    }
    const count = await client.query<{ count:number }>(
      `SELECT count(*)::int AS count FROM challenge_checkins
       WHERE enrollment_id=$1 AND verification_status='verified'`,[enrollmentId]);
    const nextCount = count.rows[0].count + 1;
    const completed = nextCount >= item.goalDays;
    const grant = completed ? await grantLimitedAcorns(client,{
      userId,requestedAmount:item.completionAcorns,transactionType:"challenge_complete",
      referenceId:`${enrollmentId}:${today}`,description:`${item.title} 완료 보상`,
    }) : { granted:0,dailyRemaining:0 };
    const reward = grant.granted;
    const inserted = await client.query(
      `INSERT INTO challenge_checkins(
        enrollment_id,checkin_on,note,evidence,verification_status,verified_at,acorns_earned
       ) VALUES($1,$2::date,$3,$4::jsonb,'verified',now(),$5)
       ON CONFLICT(enrollment_id,checkin_on) DO NOTHING RETURNING id`,
      [enrollmentId,today,validation.summary,JSON.stringify(validation.evidence),reward],
    );
    if (!inserted.rows[0]) {
      await client.query("ROLLBACK");
      return errorResponse("오늘 인증은 이미 완료했어요.",409);
    }
    if (completed) {
      await client.query(`UPDATE challenge_enrollments SET status='completed',completed_at=now() WHERE id=$1`,[enrollmentId]);
    }
    await client.query("COMMIT");
    return jsonResponse({ reward,completed,checkinCount:nextCount });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

type ValidationResult =
  | { ok:true;evidence:Evidence;summary:string }
  | { ok:false;message:string };

function validateEvidence(type:VerificationType,config:VerificationConfig,raw:Record<string,unknown>):ValidationResult {
  const detail = cleanText(raw.detail,160);
  const subject = cleanText(raw.subject,80);
  const choice = cleanText(raw.choice,30);
  const amount = Number(raw.amount);
  const needsAmount = ["duration","quantity","duration_choice","reading"].includes(type);
  if (needsAmount) {
    const min = integer(config.min,1);
    const max = integer(config.max,9999);
    if (!Number.isInteger(amount) || amount < min || amount > max) {
      return { ok:false,message:`${config.amountLabel || "실천량"}을 ${min}~${max}${config.unit || ""} 사이로 입력해 주세요.` };
    }
  }
  if (type === "duration_choice") {
    const options = Array.isArray(config.options) ? config.options : [];
    if (!choice || !options.includes(choice)) return { ok:false,message:`${config.choiceLabel || "활동"}을 선택해 주세요.` };
  }
  if (type === "two_text") {
    const subjectError = validateText(subject,integer(config.subjectMin,2),config.subjectLabel || "실천 대상");
    if (subjectError) return { ok:false,message:subjectError };
    const detailError = validateText(detail,integer(config.resultMin,4),config.resultLabel || "실천 결과");
    if (detailError) return { ok:false,message:detailError };
  } else if (type === "reading" || type === "reflection" || config.detailRequired) {
    const detailError = validateText(detail,integer(config.detailMin,type === "reflection" ? 10 : 5),config.detailLabel || "실천 내용");
    if (detailError) return { ok:false,message:detailError };
  } else if (detail) {
    const detailError = validateText(detail,2,config.detailLabel || "실천 내용");
    if (detailError) return { ok:false,message:detailError };
  }
  const evidence:Evidence = {};
  if (needsAmount) evidence.amount=amount;
  if (choice) evidence.choice=choice;
  if (subject) evidence.subject=subject;
  if (detail) evidence.detail=detail;
  const summary = [
    needsAmount ? `${config.amountLabel || "실천량"} ${amount}${config.unit || ""}` : "",
    choice,subject,detail,
  ].filter(Boolean).join(" · ").slice(0,160);
  return { ok:true,evidence,summary };
}

function validateText(value:string,min:number,label:string) {
  const compact = value.replace(/\s/g,"");
  if (compact.length < min) return `${label}을 ${min}자 이상 구체적으로 입력해 주세요.`;
  if (compact.length >= 4 && new Set([...compact]).size < 2) return `${label}에 반복 문자 대신 실제 내용을 입력해 주세요.`;
  if ((value.match(/[가-힣A-Za-z]/g) || []).length < 2) return `${label}에 실제 실천 내용을 입력해 주세요.`;
  return "";
}

function cleanText(value:unknown,max:number) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g," ").trim().slice(0,max);
}

function integer(value:unknown,fallback:number) {
  const parsed=Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function isRecord(value:unknown):value is Record<string,unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function OPTIONS() { return corsPreflightResponse(); }
