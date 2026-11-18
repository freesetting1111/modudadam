import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const kstDate = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    await ensureAccount(user.id);
    const requestedMonth = request.nextUrl.searchParams.get("month") || kstDate().slice(0,7);
    const month = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : kstDate().slice(0,7);
    const [wallet,checkins,stamps,recent] = await Promise.all([
      query<{ balance:number;lifetimeEarned:number;lifetimeSpent:number }>(`SELECT balance,lifetime_earned AS "lifetimeEarned",lifetime_spent AS "lifetimeSpent" FROM acorn_wallets WHERE user_id=$1`,[user.id]),
      query<{ attendanceOn:string;stampCode:string;emoji:string;acornsEarned:number }>(`SELECT checkins.attendance_on::text AS "attendanceOn",checkins.stamp_code AS "stampCode",catalog.emoji,checkins.acorns_earned AS "acornsEarned" FROM attendance_checkins checkins JOIN attendance_stamp_catalog catalog ON catalog.code=checkins.stamp_code WHERE checkins.user_id=$1 AND to_char(checkins.attendance_on,'YYYY-MM')=$2 ORDER BY checkins.attendance_on`,[user.id,month]),
      query<{ code:string;name:string;emoji:string;description:string;price:number;owned:boolean;equipped:boolean }>(`SELECT catalog.code,catalog.name,catalog.emoji,catalog.description,catalog.price,(owned.stamp_code IS NOT NULL) AS owned,COALESCE(owned.equipped,false) AS equipped FROM attendance_stamp_catalog catalog LEFT JOIN user_attendance_stamps owned ON owned.stamp_code=catalog.code AND owned.user_id=$1 WHERE catalog.enabled ORDER BY catalog.sort_order`,[user.id]),
      query<{ attendanceOn:string }>(`SELECT attendance_on::text AS "attendanceOn" FROM attendance_checkins WHERE user_id=$1 ORDER BY attendance_on DESC LIMIT 60`,[user.id]),
    ]);
    const today = kstDate();
    return jsonResponse({ month,today,todayChecked:recent.rows.some((row) => row.attendanceOn === today),streak:calculateStreak(recent.rows.map((row) => row.attendanceOn),today),wallet:wallet.rows[0],checkins:checkins.rows,stamps:stamps.rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("출석부를 불러오지 못했습니다.",500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    if (body.action === "attend") return attend(user.id);
    if (body.action === "purchase") return purchaseStamp(user.id,String(body.stampCode || ""));
    if (body.action === "equip") return equipStamp(user.id,String(body.stampCode || ""));
    return errorResponse("요청 내용을 확인해 주세요.");
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("출석부 요청을 처리하지 못했습니다.",500);
  }
}

async function ensureAccount(userId:string) {
  await query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
  await query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,'basic',true) ON CONFLICT(user_id,stamp_code) DO NOTHING`,[userId]);
}

async function attend(userId:string) {
  const client = await db.connect(); const today = kstDate();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    await client.query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,'basic',true) ON CONFLICT(user_id,stamp_code) DO NOTHING`,[userId]);
    const exists = await client.query(`SELECT id FROM attendance_checkins WHERE user_id=$1 AND attendance_on=$2::date`,[userId,today]);
    if (exists.rows[0]) { await client.query("ROLLBACK"); return errorResponse("오늘 출석 스탬프는 이미 받았어요.",409); }
    const recent = await client.query<{ attendanceOn:string }>(`SELECT attendance_on::text AS "attendanceOn" FROM attendance_checkins WHERE user_id=$1 ORDER BY attendance_on DESC LIMIT 60`,[userId]);
    const streak = calculateStreak(recent.rows.map((row) => row.attendanceOn),previousDate(today,1)) + 1;
    const bonus = streak % 30 === 0 ? 10 : streak % 7 === 0 ? 3 : 0;
    const reward = 1 + bonus;
    const equipped = await client.query<{ stampCode:string }>(`SELECT stamp_code AS "stampCode" FROM user_attendance_stamps WHERE user_id=$1 AND equipped LIMIT 1`,[userId]);
    const stampCode = equipped.rows[0]?.stampCode || "basic";
    await client.query(`INSERT INTO attendance_checkins(user_id,attendance_on,stamp_code,acorns_earned) VALUES($1,$2::date,$3,$4)`,[userId,today,stampCode,reward]);
    await client.query(`UPDATE acorn_wallets SET balance=balance+$2,lifetime_earned=lifetime_earned+$2,updated_at=now() WHERE user_id=$1`,[userId,reward]);
    await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES($1,$2,$3,$4,$5)`,[userId,reward,bonus ? "attendance_bonus" : "attendance",today,bonus ? `${streak}일 연속 출석 보너스` : "오늘의 출석"]);
    await client.query("COMMIT");
    return jsonResponse({ reward,streak,bonus,stampCode },{ status:201 });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function purchaseStamp(userId:string,stampCode:string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN"); await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    const stamp = await client.query<{ name:string;price:number }>(`SELECT name,price FROM attendance_stamp_catalog WHERE code=$1 AND enabled FOR UPDATE`,[stampCode]);
    if (!stamp.rows[0]) { await client.query("ROLLBACK"); return errorResponse("스탬프를 찾을 수 없습니다.",404); }
    const owned = await client.query(`SELECT 1 FROM user_attendance_stamps WHERE user_id=$1 AND stamp_code=$2`,[userId,stampCode]);
    if (owned.rows[0]) { await client.query("ROLLBACK"); return errorResponse("이미 보유한 스탬프입니다.",409); }
    const deducted = await client.query(`UPDATE acorn_wallets SET balance=balance-$2,lifetime_spent=lifetime_spent+$2,updated_at=now() WHERE user_id=$1 AND balance >= $2 RETURNING balance`,[userId,stamp.rows[0].price]);
    if (!deducted.rows[0]) { await client.query("ROLLBACK"); return errorResponse("도토리가 부족합니다.",409); }
    await client.query(`INSERT INTO user_attendance_stamps(user_id,stamp_code) VALUES($1,$2)`,[userId,stampCode]);
    await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES($1,$2,'stamp_purchase',$3,$4)`,[userId,-stamp.rows[0].price,stampCode,`${stamp.rows[0].name} 스탬프 해금`]);
    await client.query("COMMIT"); return jsonResponse({ purchased:true,balance:deducted.rows[0].balance });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function equipStamp(userId:string,stampCode:string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(`SELECT 1 FROM user_attendance_stamps WHERE user_id=$1 AND stamp_code=$2`,[userId,stampCode]);
    if (!owned.rows[0]) { await client.query("ROLLBACK"); return errorResponse("보유한 스탬프만 사용할 수 있습니다.",403); }
    await client.query(`UPDATE user_attendance_stamps SET equipped=false WHERE user_id=$1 AND equipped`,[userId]);
    await client.query(`UPDATE user_attendance_stamps SET equipped=true WHERE user_id=$1 AND stamp_code=$2`,[userId,stampCode]);
    await client.query("COMMIT"); return jsonResponse({ equipped:true,stampCode });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

function previousDate(value:string,days:number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate()-days); return date.toISOString().slice(0,10); }
function calculateStreak(values:string[],anchor:string) { const dates = new Set(values); let count=0; let cursor=anchor; while (dates.has(cursor)) { count++; cursor=previousDate(cursor,1); } return count; }
export function OPTIONS() { return corsPreflightResponse(); }
