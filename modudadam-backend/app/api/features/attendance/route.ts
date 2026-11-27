import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { grantLimitedAcorns } from "@/lib/acorn-economy";

const kstDate = () => new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
const rarityOrder = ["uncommon","common","rare","epic","legendary","mythic"];
const MISDEED_CONVERSION_AMOUNT = 1000;
const REPUTATION_POINT_LIMIT = 20000;

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    await ensureAccount(user.id,user.email);
    await query(`SELECT grant_activity_achievement_stamps($1::uuid)`,[user.id]);
    const requestedMonth = request.nextUrl.searchParams.get("month") || kstDate().slice(0,7);
    const month = /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : kstDate().slice(0,7);
    const [wallet,checkins,stamps,recent,titleCatalog,reputation,activityAchievements] = await Promise.all([
      query<{ balance:number;lifetimeEarned:number;lifetimeSpent:number }>(`SELECT balance,lifetime_earned AS "lifetimeEarned",lifetime_spent AS "lifetimeSpent" FROM acorn_wallets WHERE user_id=$1`,[user.id]),
      query<{ attendanceOn:string;stampCode:string;emoji:string;acornsEarned:number }>(`SELECT checkins.attendance_on::text AS "attendanceOn",'basic' AS "stampCode",catalog.emoji,checkins.acorns_earned AS "acornsEarned" FROM attendance_checkins checkins JOIN attendance_stamp_catalog catalog ON catalog.code='basic' WHERE checkins.user_id=$1 AND to_char(checkins.attendance_on,'YYYY-MM')=$2 ORDER BY checkins.attendance_on`,[user.id,month]),
      query<{ code:string;name:string;emoji:string;description:string;price:number;rarity:string;accessScope:string;owned:boolean;equipped:boolean }>(`SELECT catalog.code,catalog.name,catalog.emoji,catalog.description,catalog.price,catalog.rarity,catalog.access_scope AS "accessScope",
        CASE
          WHEN catalog.access_scope='reputation' THEN owned.stamp_code IS NOT NULL AND (
            EXISTS(SELECT 1 FROM reputation_point_ledger purchase WHERE purchase.user_id=$1 AND purchase.source_type='stamp_purchase' AND purchase.source_key=catalog.code AND purchase.amount<0)
            OR EXISTS(SELECT 1 FROM acorn_transactions legacy WHERE legacy.user_id=$1 AND legacy.transaction_type='stamp_purchase' AND legacy.reference_id=catalog.code)
          )
          WHEN catalog.access_scope='public' AND catalog.code NOT IN ('basic','sprout') THEN owned.stamp_code IS NOT NULL AND EXISTS(SELECT 1 FROM acorn_transactions purchase WHERE purchase.user_id=$1 AND purchase.transaction_type='stamp_purchase' AND purchase.reference_id=catalog.code)
          ELSE owned.stamp_code IS NOT NULL
        END AS owned,
        CASE
          WHEN catalog.access_scope='reputation' AND NOT (
            EXISTS(SELECT 1 FROM reputation_point_ledger purchase WHERE purchase.user_id=$1 AND purchase.source_type='stamp_purchase' AND purchase.source_key=catalog.code AND purchase.amount<0)
            OR EXISTS(SELECT 1 FROM acorn_transactions legacy WHERE legacy.user_id=$1 AND legacy.transaction_type='stamp_purchase' AND legacy.reference_id=catalog.code)
          ) THEN false
          WHEN catalog.access_scope='public' AND catalog.code NOT IN ('basic','sprout') AND NOT EXISTS(SELECT 1 FROM acorn_transactions purchase WHERE purchase.user_id=$1 AND purchase.transaction_type='stamp_purchase' AND purchase.reference_id=catalog.code) THEN false
          ELSE COALESCE(owned.equipped,false)
        END AS equipped
        FROM attendance_stamp_catalog catalog LEFT JOIN user_attendance_stamps owned ON owned.stamp_code=catalog.code AND owned.user_id=$1
        WHERE catalog.enabled AND (catalog.access_scope IN ('public','reputation') OR ($2::text='freesetting@naver.com' AND catalog.access_scope='operator') OR (catalog.access_scope='achievement' AND owned.stamp_code IS NOT NULL)) ORDER BY catalog.sort_order`,[user.id,user.email?.trim().toLowerCase() || null]),
      query<{ attendanceOn:string }>(`SELECT attendance_on::text AS "attendanceOn" FROM attendance_checkins WHERE user_id=$1 ORDER BY attendance_on DESC LIMIT 60`,[user.id]),
      query<{ code:string;name:string;emoji:string;description:string;requiredRarity:string;requiresAllPublic:boolean;rewardStampCode:string;rewardStampName:string;rewardStampEmoji:string;claimed:boolean }>(`SELECT title.code,title.name,title.emoji,title.description,title.required_rarity AS "requiredRarity",title.requires_all_public AS "requiresAllPublic",title.reward_stamp_code AS "rewardStampCode",reward.name AS "rewardStampName",reward.emoji AS "rewardStampEmoji",(owned.stamp_code IS NOT NULL) AS claimed FROM stamp_collection_title_catalog title JOIN attendance_stamp_catalog reward ON reward.code=title.reward_stamp_code LEFT JOIN user_attendance_stamps owned ON owned.stamp_code=reward.code AND owned.user_id=$1 WHERE title.enabled ORDER BY title.sort_order`,[user.id]),
      query<{ kindnessPoints:number;misdeedPoints:number }>(`SELECT kindness_points AS "kindnessPoints",misdeed_points AS "misdeedPoints" FROM user_reputation_points WHERE user_id=$1`,[user.id]),
      query<{ code:string;stampCode:string;name:string;emoji:string;description:string;rarity:string;metricType:string;target:number;progress:number;owned:boolean;equipped:boolean }>(
        `SELECT achievement.code,achievement.stamp_code AS "stampCode",catalog.name,catalog.emoji,catalog.description,catalog.rarity,
          achievement.metric_type AS "metricType",achievement.threshold AS target,
          LEAST(achievement.threshold,
            CASE achievement.metric_type
              WHEN 'detective_solved' THEN (SELECT count(*) FROM detective_daily_attempts WHERE user_id=$1 AND status='solved')
              WHEN 'mission_completed' THEN (SELECT count(*) FROM daily_mission_attempts WHERE user_id=$1 AND completed_at IS NOT NULL)
              WHEN 'treasure_likes_received' THEN (
                SELECT count(*) FROM local_treasure_likes likes
                JOIN local_treasures treasures ON treasures.id=likes.treasure_id
                WHERE treasures.author_id=$1 AND treasures.status='published'
              )
              WHEN 'challenge_checkin_days' THEN (
                SELECT count(DISTINCT checkins.checkin_on) FROM challenge_checkins checkins
                JOIN challenge_enrollments enrollments ON enrollments.id=checkins.enrollment_id
                WHERE enrollments.user_id=$1 AND checkins.verification_status='verified'
              )
              ELSE 0
            END
          )::int AS progress,
          (owned.stamp_code IS NOT NULL) AS owned,COALESCE(owned.equipped,false) AS equipped
        FROM activity_stamp_achievement_catalog achievement
        JOIN attendance_stamp_catalog catalog ON catalog.code=achievement.stamp_code
        LEFT JOIN user_attendance_stamps owned ON owned.user_id=$1 AND owned.stamp_code=achievement.stamp_code
        WHERE achievement.enabled AND catalog.enabled
        ORDER BY achievement.sort_order`,[user.id]),
    ]);
    const today = kstDate();
    const completedRarities = new Set(rarityOrder.filter((rarity) => {
      const tier=stamps.rows.filter((stamp) => stamp.accessScope==='public' && stamp.rarity===rarity); return tier.length>0 && tier.every((stamp) => stamp.owned);
    }));
    const reputationPoints=reputation.rows[0] || { kindnessPoints:0,misdeedPoints:0 };
    const stampItems=stamps.rows.map((stamp) => {
      const target=Number(stamp.code.match(/\d+$/)?.[0] || 0);
      const unlocked=stamp.accessScope==='reputation'
        ? stamp.code.startsWith('kindness_') ? reputationPoints.kindnessPoints>=target : stamp.code.startsWith('misdeed_') && reputationPoints.misdeedPoints>=target
        : stamp.accessScope!=='public' || rarityOrder.slice(0,rarityOrder.indexOf(stamp.rarity)).every((rarity) => completedRarities.has(rarity));
      return { ...stamp,unlocked };
    });
    const publicStamps=stamps.rows.filter((stamp) => stamp.accessScope==='public');
    const collectionTitles=titleCatalog.rows.map((title) => {
      const requiredStamps=title.requiresAllPublic ? publicStamps : publicStamps.filter((stamp) => stamp.rarity===title.requiredRarity);
      const collected=requiredStamps.filter((stamp) => stamp.owned).length;
      return { ...title,collected,total:requiredStamps.length,unlocked:requiredStamps.length>0 && collected===requiredStamps.length };
    });
    return jsonResponse({ month,today,todayChecked:recent.rows.some((row) => row.attendanceOn === today),streak:calculateStreak(recent.rows.map((row) => row.attendanceOn),today),wallet:wallet.rows[0],reputation:reputation.rows[0],checkins:checkins.rows,stamps:stampItems,titles:collectionTitles,activityAchievements:activityAchievements.rows });
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
    if (body.action === "convert_misdeed") return convertAcornsToMisdeedPoints(user.id);
    if (body.action === "claim_collection_reward") return claimCollectionReward(user.id,String(body.titleCode || ""));
    return errorResponse("요청 내용을 확인해 주세요.");
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("출석부 요청을 처리하지 못했습니다.",500);
  }
}

async function ensureAccount(userId:string,email:string | null) {
  await query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
  await query(`INSERT INTO user_reputation_points(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
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
    const bonus = streak % 30 === 0 ? 3 : streak % 7 === 0 ? 1 : 0;
    const grant=await grantLimitedAcorns(client,{
      userId,requestedAmount:1+bonus,transactionType:bonus ? "attendance_bonus" : "attendance",
      referenceId:today,description:bonus ? `${streak}일 연속 출석 보너스` : "오늘의 출석",
    });
    const reward=grant.granted;
    const stampCode = "basic";
    await client.query(`INSERT INTO attendance_checkins(user_id,attendance_on,stamp_code,acorns_earned) VALUES($1,$2::date,$3,$4)`,[userId,today,stampCode,reward]);
    await client.query("COMMIT");
    return jsonResponse({ reward,streak,bonus:Math.min(bonus,Math.max(0,reward-1)),walletFull:reward===0&&grant.dailyRemaining>0,dailyLimitReached:reward===0&&grant.dailyRemaining===0,dailyRemaining:grant.dailyRemaining,stampCode },{ status:201 });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function purchaseStamp(userId:string,email:string | null,stampCode:string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    await client.query(`INSERT INTO user_reputation_points(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    const stamp = await client.query<{ name:string;price:number;rarity:string;accessScope:string }>(`SELECT name,price,rarity,access_scope AS "accessScope" FROM attendance_stamp_catalog WHERE code=$1 AND enabled AND (access_scope IN ('public','reputation') OR ($2::text='freesetting@naver.com' AND access_scope='operator')) FOR UPDATE`,[stampCode,email?.trim().toLowerCase() || null]);
    if (!stamp.rows[0]) { await client.query("ROLLBACK"); return errorResponse("스탬프를 찾을 수 없습니다.",404); }
    const owned = await client.query(`SELECT 1 FROM user_attendance_stamps owned WHERE owned.user_id=$1 AND owned.stamp_code=$2 AND (
      $3::text NOT IN ('public','reputation')
      OR ($3::text='public' AND $2=ANY(ARRAY['basic','sprout']::text[]))
      OR ($3::text='public' AND EXISTS(SELECT 1 FROM acorn_transactions purchase WHERE purchase.user_id=$1 AND purchase.transaction_type='stamp_purchase' AND purchase.reference_id=$2))
      OR ($3::text='reputation' AND (
        EXISTS(SELECT 1 FROM reputation_point_ledger purchase WHERE purchase.user_id=$1 AND purchase.source_type='stamp_purchase' AND purchase.source_key=$2 AND purchase.amount<0)
        OR EXISTS(SELECT 1 FROM acorn_transactions legacy WHERE legacy.user_id=$1 AND legacy.transaction_type='stamp_purchase' AND legacy.reference_id=$2)
      ))
    )`,[userId,stampCode,stamp.rows[0].accessScope]);
    if (owned.rows[0]) { await client.query("ROLLBACK"); return errorResponse("이미 보유한 스탬프입니다.",409); }
    if (stamp.rows[0].accessScope==='reputation') {
      const target=Number(stampCode.match(/\d+$/)?.[0] || 0);
      const pointType=stampCode.startsWith('kindness_') ? 'kindness' : stampCode.startsWith('misdeed_') ? 'misdeed' : null;
      const points=pointType ? await client.query<{ points:number }>(`SELECT CASE WHEN $2='kindness' THEN kindness_points ELSE misdeed_points END AS points FROM user_reputation_points WHERE user_id=$1 FOR UPDATE`,[userId,pointType]) : { rows:[] };
      if (!pointType || (points.rows[0]?.points || 0)<target) { await client.query("ROLLBACK"); return errorResponse(`필요한 ${pointType==='misdeed' ? '악행' : '선행'} 포인트를 달성해야 구매할 수 있습니다.`,423); }
      const spent=pointType==='kindness'
        ? await client.query<{ pointsRemaining:number }>(`UPDATE user_reputation_points SET kindness_points=kindness_points-$2,updated_at=now() WHERE user_id=$1 AND kindness_points >= $2 RETURNING kindness_points AS "pointsRemaining"`,[userId,stamp.rows[0].price])
        : await client.query<{ pointsRemaining:number }>(`UPDATE user_reputation_points SET misdeed_points=misdeed_points-$2,updated_at=now() WHERE user_id=$1 AND misdeed_points >= $2 RETURNING misdeed_points AS "pointsRemaining"`,[userId,stamp.rows[0].price]);
      if (!spent.rows[0]) { await client.query("ROLLBACK"); return errorResponse(`${pointType==='misdeed' ? '악행' : '선행'} 포인트가 부족합니다.`,409); }
      await client.query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,$2,false) ON CONFLICT(user_id,stamp_code) DO UPDATE SET equipped=false`,[userId,stampCode]);
      await client.query(`INSERT INTO reputation_point_ledger(user_id,point_type,amount,source_type,source_key,description) VALUES($1,$2,$3*-1,'stamp_purchase',$4,$5)`,[userId,pointType,stamp.rows[0].price,stampCode,`${stamp.rows[0].name} 스탬프 구매`]);
      await client.query("COMMIT");
      return jsonResponse({ purchased:true,purchaseCurrency:pointType,spentPoints:stamp.rows[0].price,pointsRemaining:spent.rows[0].pointsRemaining });
    }
    const previousRarities=stamp.rows[0].accessScope==='public' ? rarityOrder.slice(0,rarityOrder.indexOf(stamp.rows[0].rarity)) : [];
    if (previousRarities.length) {
      const locked=await client.query(`SELECT 1 FROM attendance_stamp_catalog catalog WHERE catalog.enabled AND catalog.access_scope='public' AND catalog.rarity=ANY($2::text[]) AND NOT EXISTS(SELECT 1 FROM user_attendance_stamps owned WHERE owned.user_id=$1 AND owned.stamp_code=catalog.code) LIMIT 1`,[userId,previousRarities]);
      if (locked.rows[0]) { await client.query("ROLLBACK"); return errorResponse("이전 등급의 스탬프를 모두 모아야 해금할 수 있습니다.",423); }
    }
    const deducted = await client.query(`UPDATE acorn_wallets SET balance=balance-$2,lifetime_spent=lifetime_spent+$2,updated_at=now() WHERE user_id=$1 AND balance >= $2 RETURNING balance`,[userId,stamp.rows[0].price]);
    if (!deducted.rows[0]) { await client.query("ROLLBACK"); return errorResponse("도토리가 부족합니다.",409); }
    await client.query(`INSERT INTO user_attendance_stamps(user_id,stamp_code,equipped) VALUES($1,$2,false) ON CONFLICT(user_id,stamp_code) DO UPDATE SET equipped=false`,[userId,stampCode]);
    await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES($1,$2,'stamp_purchase',$3,$4)`,[userId,-stamp.rows[0].price,stampCode,`${stamp.rows[0].name} 스탬프 해금`]);
    await client.query("COMMIT"); return jsonResponse({ purchased:true,balance:deducted.rows[0].balance });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function equipStamp(userId:string,stampCode:string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const owned = await client.query(`SELECT 1 FROM user_attendance_stamps owned JOIN attendance_stamp_catalog catalog ON catalog.code=owned.stamp_code WHERE owned.user_id=$1 AND owned.stamp_code=$2 AND catalog.enabled AND (
      catalog.access_scope NOT IN ('public','reputation')
      OR (catalog.access_scope='public' AND catalog.code=ANY(ARRAY['basic','sprout']::text[]))
      OR (catalog.access_scope='public' AND EXISTS(SELECT 1 FROM acorn_transactions purchase WHERE purchase.user_id=$1 AND purchase.transaction_type='stamp_purchase' AND purchase.reference_id=catalog.code))
      OR (catalog.access_scope='reputation' AND (
        EXISTS(SELECT 1 FROM reputation_point_ledger purchase WHERE purchase.user_id=$1 AND purchase.source_type='stamp_purchase' AND purchase.source_key=catalog.code AND purchase.amount<0)
        OR EXISTS(SELECT 1 FROM acorn_transactions legacy WHERE legacy.user_id=$1 AND legacy.transaction_type='stamp_purchase' AND legacy.reference_id=catalog.code)
      ))
    )`,[userId,stampCode]);
    if (!owned.rows[0]) { await client.query("ROLLBACK"); return errorResponse("보유한 스탬프만 사용할 수 있습니다.",403); }
    await client.query(`UPDATE user_attendance_stamps SET equipped=false WHERE user_id=$1 AND equipped`,[userId]);
    await client.query(`UPDATE user_attendance_stamps SET equipped=true WHERE user_id=$1 AND stamp_code=$2`,[userId,stampCode]);
    await client.query("COMMIT"); return jsonResponse({ equipped:true,stampCode });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function convertAcornsToMisdeedPoints(userId:string) {
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    await client.query(`INSERT INTO user_reputation_points(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    const reputation=await client.query<{ misdeedPoints:number }>(`SELECT misdeed_points AS "misdeedPoints" FROM user_reputation_points WHERE user_id=$1 FOR UPDATE`,[userId]);
    const currentPoints=reputation.rows[0]?.misdeedPoints || 0;
    if (currentPoints+MISDEED_CONVERSION_AMOUNT>REPUTATION_POINT_LIMIT) {
      await client.query("ROLLBACK");
      return errorResponse("악행 포인트는 최대 20,000점까지 보유할 수 있습니다.",409);
    }
    const wallet=await client.query<{ balance:number }>(`UPDATE acorn_wallets SET balance=balance-$2,lifetime_spent=lifetime_spent+$2,updated_at=now() WHERE user_id=$1 AND balance >= $2 RETURNING balance`,[userId,MISDEED_CONVERSION_AMOUNT]);
    if (!wallet.rows[0]) {
      await client.query("ROLLBACK");
      return errorResponse("도토리가 부족합니다. 전환에는 도토리 1,000개가 필요합니다.",409);
    }
    const transaction=await client.query<{ id:string }>(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,description) VALUES($1,$2,'misdeed_conversion','도토리를 악행 포인트로 전환') RETURNING id::text`,[userId,-MISDEED_CONVERSION_AMOUNT]);
    const updated=await client.query<{ misdeedPoints:number }>(`UPDATE user_reputation_points SET misdeed_points=misdeed_points+$2,updated_at=now() WHERE user_id=$1 RETURNING misdeed_points AS "misdeedPoints"`,[userId,MISDEED_CONVERSION_AMOUNT]);
    await client.query(`INSERT INTO reputation_point_ledger(user_id,point_type,amount,source_type,source_key,description) VALUES($1,'misdeed',$2,'acorn_conversion',$3,'도토리 악행 포인트 전환')`,[userId,MISDEED_CONVERSION_AMOUNT,transaction.rows[0].id]);
    await client.query("COMMIT");
    return jsonResponse({ converted:true,spentAcorns:MISDEED_CONVERSION_AMOUNT,addedPoints:MISDEED_CONVERSION_AMOUNT,balance:wallet.rows[0].balance,misdeedPoints:updated.rows[0].misdeedPoints });
  } catch(error) { await client.query("ROLLBACK");throw error; } finally { client.release(); }
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
