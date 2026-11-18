import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const kstDate = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
const rarityOrder = ["uncommon","common","rare","epic","legendary","mythic"];

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    await ensureAccount(user.id,user.email);
    const requestedMonth = request.nextUrl.searchParams.get("month") || kstDate().slice(0,7);
    const month = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : kstDate().slice(0,7);
    const [wallet,checkins,stamps,recent,titleCatalog] = await Promise.all([
      query<{ balance:number;lifetimeEarned:number;lifetimeSpent:number }>(`SELECT balance,lifetime_earned AS "lifetimeEarned",lifetime_spent AS "lifetimeSpent" FROM acorn_wallets WHERE user_id=$1`,[user.id]),
      query<{ attendanceOn:string;stampCode:string;emoji:string;acornsEarned:number }>(`SELECT checkins.attendance_on::text AS "attendanceOn",'basic' AS "stampCode",catalog.emoji,checkins.acorns_earned AS "acornsEarned" FROM attendance_checkins checkins JOIN attendance_stamp_catalog catalog ON catalog.code='basic' WHERE checkins.user_id=$1 AND to_char(checkins.attendance_on,'YYYY-MM')=$2 ORDER BY checkins.attendance_on`,[user.id,month]),
      query<{ code:string;name:string;emoji:string;description:string;price:number;rarity:string;accessScope:string;owned:boolean;equipped:boolean }>(`SELECT catalog.code,catalog.name,catalog.emoji,catalog.description,catalog.price,catalog.rarity,catalog.access_scope AS "accessScope",(owned.stamp_code IS NOT NULL) AS owned,COALESCE(owned.equipped,false) AS equipped FROM attendance_stamp_catalog catalog LEFT JOIN user_attendance_stamps owned ON owned.stamp_code=catalog.code AND owned.user_id=$1 WHERE catalog.enabled AND (catalog.access_scope='public' OR ($2::text='freesetting@naver.com' AND catalog.access_scope='operator') OR (catalog.access_scope='achievement' AND owned.stamp_code IS NOT NULL)) ORDER BY catalog.sort_order`,[user.id,user.email?.trim().toLowerCase() || null]),
      query<{ attendanceOn:string }>(`SELECT attendance_on::text AS "attendanceOn" FROM attendance_checkins WHERE user_id=$1 ORDER BY attendance_on DESC LIMIT 60`,[user.id]),
      query<{ code:string;name:string;emoji:string;description:string;requiredRarity:string;requiresAllPublic:boolean;rewardStampCode:string;rewardStampName:string;rewardStampEmoji:string;claimed:boolean }>(`SELECT title.code,title.name,title.emoji,title.description,title.required_rarity AS "requiredRarity",title.requires_all_public AS "requiresAllPublic",title.reward_stamp_code AS "rewardStampCode",reward.name AS "rewardStampName",reward.emoji AS "rewardStampEmoji",(owned.stamp_code IS NOT NULL) AS claimed FROM stamp_collection_title_catalog title JOIN attendance_stamp_catalog reward ON reward.code=title.reward_stamp_code LEFT JOIN user_attendance_stamps owned ON owned.stamp_code=reward.code AND owned.user_id=$1 WHERE title.enabled ORDER BY title.sort_order`,[user.id]),
    ]);
    const today = kstDate();
    const completedRarities = new Set(rarityOrder.filter((rarity) => {
      const tier=stamps.rows.filter((stamp) => stamp.accessScope==='public' && stamp.rarity===rarity); return tier.length>0 && tier.every((stamp) => stamp.owned);
    }));
    const stampItems=stamps.rows.map((stamp) => ({ ...stamp,unlocked:stamp.accessScope!=='public' || rarityOrder.slice(0,rarityOrder.indexOf(stamp.rarity)).every((rarity) => completedRarities.has(rarity)) }));
    const publicStamps=stamps.rows.filter((stamp) => stamp.accessScope==='public');
    const collectionTitles=titleCatalog.rows.map((title) => {
      const requiredStamps=title.requiresAllPublic ? publicStamps : publicStamps.filter((stamp) => stamp.rarity===title.requiredRarity);
      const collected=requiredStamps.filter((stamp) => stamp.owned).length;
      return { ...title,collected,total:requiredStamps.length,unlocked:requiredStamps.length>0 && collected===requiredStamps.length };
    });
    return jsonResponse({ month,today,todayChecked:recent.rows.some((row) => row.attendanceOn === today),streak:calculateStreak(recent.rows.map((row) => row.attendanceOn),today),wallet:wallet.rows[0],checkins:checkins.rows,stamps:stampItems,titles:collectionTitles });
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
    if (body.action === "purchase") return purchaseStamp(user.id,user.email,String(body.stampCode || ""));
    if (body.action === "equip") return equipStamp(user.id,String(body.stampCode || ""));
    if (body.action === "claim_collection_reward") return claimCollectionReward(user.id,String(body.titleCode || ""));
    return errorResponse("요청 내용을 확인해 주세요.");
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("출석부 요청을 처리하지 못했습니다.",500);
  }
}

async function ensureAccount(userId:string,email:string | null) {
  await query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
  await query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,'basic',true) ON CONFLICT(user_id,stamp_code) DO NOTHING`,[userId]);
  await query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,'sprout',false) ON CONFLICT(user_id,stamp_code) DO NOTHING`,[userId]);
  if (email?.trim().toLowerCase()==='freesetting@naver.com') await query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) SELECT $1,code,false FROM attendance_stamp_catalog WHERE enabled AND access_scope='operator' ON CONFLICT(user_id,stamp_code) DO NOTHING`,[userId]);
}

async function attend(userId:string) {
  const client = await db.connect(); const today = kstDate();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    await client.query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,'basic',true) ON CONFLICT(user_id,stamp_code) DO NOTHING`,[userId]);
    await client.query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,'sprout',false) ON CONFLICT(user_id,stamp_code) DO NOTHING`,[userId]);
    const exists = await client.query(`SELECT id FROM attendance_checkins WHERE user_id=$1 AND attendance_on=$2::date`,[userId,today]);
    if (exists.rows[0]) { await client.query("ROLLBACK"); return errorResponse("오늘 출석 스탬프는 이미 받았어요.",409); }
    const recent = await client.query<{ attendanceOn:string }>(`SELECT attendance_on::text AS "attendanceOn" FROM attendance_checkins WHERE user_id=$1 ORDER BY attendance_on DESC LIMIT 60`,[userId]);
    const streak = calculateStreak(recent.rows.map((row) => row.attendanceOn),previousDate(today,1)) + 1;
    const bonus = streak % 30 === 0 ? 10 : streak % 7 === 0 ? 3 : 0;
    const wallet = await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[userId]);
    const reward = Math.max(0,Math.min(1+bonus,9999-(wallet.rows[0]?.balance || 0)));
    const stampCode = "basic";
    await client.query(`INSERT INTO attendance_checkins(user_id,attendance_on,stamp_code,acorns_earned) VALUES($1,$2::date,$3,$4)`,[userId,today,stampCode,reward]);
    if (reward>0) {
      await client.query(`UPDATE acorn_wallets SET balance=balance+$2,lifetime_earned=lifetime_earned+$2,updated_at=now() WHERE user_id=$1`,[userId,reward]);
      await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES($1,$2,$3,$4,$5)`,[userId,reward,bonus ? "attendance_bonus" : "attendance",today,bonus ? `${streak}일 연속 출석 보너스` : "오늘의 출석"]);
    }
    await client.query("COMMIT");
    return jsonResponse({ reward,streak,bonus:Math.min(bonus,reward),walletFull:reward===0,stampCode },{ status:201 });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function purchaseStamp(userId:string,email:string | null,stampCode:string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN"); await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    const stamp = await client.query<{ name:string;price:number;rarity:string }>(`SELECT name,price,rarity FROM attendance_stamp_catalog WHERE code=$1 AND enabled AND (access_scope='public' OR ($2::text='freesetting@naver.com' AND access_scope='operator')) FOR UPDATE`,[stampCode,email?.trim().toLowerCase() || null]);
    if (!stamp.rows[0]) { await client.query("ROLLBACK"); return errorResponse("스탬프를 찾을 수 없습니다.",404); }
    const owned = await client.query(`SELECT 1 FROM user_attendance_stamps WHERE user_id=$1 AND stamp_code=$2`,[userId,stampCode]);
    if (owned.rows[0]) { await client.query("ROLLBACK"); return errorResponse("이미 보유한 스탬프입니다.",409); }
    const previousRarities=rarityOrder.slice(0,rarityOrder.indexOf(stamp.rows[0].rarity));
    if (previousRarities.length) {
      const locked=await client.query(`SELECT 1 FROM attendance_stamp_catalog catalog WHERE catalog.enabled AND catalog.access_scope='public' AND catalog.rarity=ANY($2::text[]) AND NOT EXISTS(SELECT 1 FROM user_attendance_stamps owned WHERE owned.user_id=$1 AND owned.stamp_code=catalog.code) LIMIT 1`,[userId,previousRarities]);
      if (locked.rows[0]) { await client.query("ROLLBACK"); return errorResponse("이전 등급의 스탬프를 모두 모아야 해금할 수 있습니다.",423); }
    }
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

async function claimCollectionReward(userId:string,titleCode:string) {
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const title=await client.query<{ requiredRarity:string;requiresAllPublic:boolean;rewardStampCode:string;rewardStampName:string }>(`SELECT title.required_rarity AS "requiredRarity",title.requires_all_public AS "requiresAllPublic",title.reward_stamp_code AS "rewardStampCode",reward.name AS "rewardStampName" FROM stamp_collection_title_catalog title JOIN attendance_stamp_catalog reward ON reward.code=title.reward_stamp_code WHERE title.code=$1 AND title.enabled AND reward.enabled AND reward.access_scope='achievement' FOR UPDATE`,[titleCode]);
    if (!title.rows[0]) { await client.query("ROLLBACK"); return errorResponse("컬렉션 보상을 찾을 수 없습니다.",404); }
    const reward=title.rows[0];
    const missing=await client.query(`SELECT 1 FROM attendance_stamp_catalog catalog WHERE catalog.enabled AND catalog.access_scope='public' AND ($3::boolean OR catalog.rarity=$2) AND NOT EXISTS(SELECT 1 FROM user_attendance_stamps owned WHERE owned.user_id=$1 AND owned.stamp_code=catalog.code) LIMIT 1`,[userId,reward.requiredRarity,reward.requiresAllPublic]);
    if (missing.rows[0]) { await client.query("ROLLBACK"); return errorResponse("아직 해당 등급의 스탬프를 모두 모으지 못했습니다.",409); }
    const inserted=await client.query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,$2,false) ON CONFLICT(user_id,stamp_code) DO NOTHING RETURNING stamp_code`,[userId,reward.rewardStampCode]);
    await client.query("COMMIT");
    return jsonResponse({ claimed:true,alreadyClaimed:!inserted.rows[0],stampCode:reward.rewardStampCode,stampName:reward.rewardStampName });
  } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

function previousDate(value:string,days:number) { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate()-days); return date.toISOString().slice(0,10); }
function calculateStreak(values:string[],anchor:string) { const dates = new Set(values); let count=0; let cursor=anchor; while (dates.has(cursor)) { count++; cursor=previousDate(cursor,1); } return count; }
export function OPTIONS() { return corsPreflightResponse(); }
