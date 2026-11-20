import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

type GiftRow = {
  id:string; direction:"sent"|"received"; amount:number; message:string|null;
  partnerName:string; partnerStampEmoji:string|null;status:"pending"|"claimed";
  giftType:"user"|"signup_package"|"choice_reward";createdAt:string;claimedAt:string|null;
};

type PendingGiftRow = {
  id:string;amount:number;message:string|null;senderName:string;senderStampEmoji:string|null;
  giftType:"user"|"signup_package"|"choice_reward";createdAt:string;
};

const OPERATOR_EMAIL="freesetting@naver.com";
const ACORN_LIMIT=20000;

export async function GET(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    const nickname=request.nextUrl.searchParams.get("nickname")?.trim();
    if (nickname) {
      if (nickname.length>60) return errorResponse("닉네임을 확인해 주세요.");
      const recipient=await query<{ id:string;nickname:string;stampEmoji:string|null }>(
        `SELECT users.id,users.nickname,user_stamp_emoji(users.id) AS "stampEmoji"
         FROM users
         WHERE lower(users.nickname)=lower($1)
           AND users.status='active' AND users.deleted_at IS NULL
           AND lower(COALESCE(users.email,''))<>$2`,
        [nickname,OPERATOR_EMAIL],
      );
      if (!recipient.rows[0]) return errorResponse("선물할 사용자를 찾을 수 없습니다.",404);
      if (recipient.rows[0].id===user.id) return errorResponse("본인에게는 도토리를 선물할 수 없습니다.",409);
      return jsonResponse({ recipient:{ nickname:recipient.rows[0].nickname,stampEmoji:recipient.rows[0].stampEmoji } });
    }

    await query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
    await query(`INSERT INTO user_reputation_points(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
    const [wallet,gifts,reputation,pendingGifts]=await Promise.all([
      query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1`,[user.id]),
      query<GiftRow>(
        `SELECT gifts.id,
          CASE WHEN gifts.sender_id=$1 THEN 'sent' ELSE 'received' END AS direction,
          gifts.amount,gifts.message,gifts.status,gifts.gift_type AS "giftType",
          COALESCE(partner.nickname,gifts.sender_display_name,'modudadam') AS "partnerName",
          user_stamp_emoji(partner.id) AS "partnerStampEmoji",
          gifts.created_at AS "createdAt",gifts.claimed_at AS "claimedAt"
         FROM acorn_gifts gifts
         LEFT JOIN users partner ON partner.id=CASE WHEN gifts.sender_id=$1 THEN gifts.recipient_id ELSE gifts.sender_id END
         WHERE gifts.sender_id=$1 OR gifts.recipient_id=$1
         ORDER BY gifts.created_at DESC LIMIT 20`,[user.id]),
      query<{ kindnessPoints:number;misdeedPoints:number }>(`SELECT kindness_points AS "kindnessPoints",misdeed_points AS "misdeedPoints" FROM user_reputation_points WHERE user_id=$1`,[user.id]),
      query<PendingGiftRow>(
        `SELECT gifts.id,gifts.amount,gifts.message,gifts.gift_type AS "giftType",gifts.created_at AS "createdAt",
          COALESCE(sender.nickname,gifts.sender_display_name,'modudadam') AS "senderName",
          user_stamp_emoji(sender.id) AS "senderStampEmoji"
         FROM acorn_gifts gifts LEFT JOIN users sender ON sender.id=gifts.sender_id
         WHERE gifts.recipient_id=$1 AND gifts.status='pending'
         ORDER BY gifts.created_at ASC`,[user.id]),
    ]);
    return jsonResponse({
      balance:wallet.rows[0]?.balance || 0,
      kindnessPoints:reputation.rows[0]?.kindnessPoints || 0,
      misdeedPoints:reputation.rows[0]?.misdeedPoints || 0,
      pendingGifts:pendingGifts.rows,
      gifts:gifts.rows,
    });
  } catch(error) {
    if (error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    console.error("[acorn-gifts] failed to load",error);
    return errorResponse("도토리 선물함을 불러오지 못했습니다.",500);
  }
}

export async function POST(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    const body=await request.json();
    if (String(body.action || "")==="claim") return await claimGift(user.id,String(body.giftId || ""));
    const nickname=String(body.nickname || "").trim();
    const amount=Number(body.amount);
    const message=String(body.message || "").trim();
    const requestKey=String(body.requestKey || "");
    if (!nickname || nickname.length>60) return errorResponse("받는 분의 닉네임을 입력해 주세요.");
    if (!Number.isInteger(amount) || amount<10 || amount>ACORN_LIMIT || amount%10!==0) return errorResponse("도토리는 10개 단위로 입력해 주세요.");
    if (message.length>80) return errorResponse("메시지는 80자까지 입력할 수 있습니다.");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) return errorResponse("선물 요청 정보가 올바르지 않습니다.");

    const client=await db.connect();
    try {
      await client.query("BEGIN");
      const duplicate=await client.query<{ id:string;recipientName:string;balance:number }>(`SELECT gifts.id,recipient.nickname AS "recipientName",wallet.balance FROM acorn_gifts gifts JOIN users recipient ON recipient.id=gifts.recipient_id JOIN acorn_wallets wallet ON wallet.user_id=gifts.sender_id WHERE gifts.sender_id=$1 AND gifts.request_key=$2::uuid`,[user.id,requestKey]);
      if (duplicate.rows[0]) {
        const points=await client.query<{ kindnessPoints:number }>(`SELECT kindness_points AS "kindnessPoints" FROM user_reputation_points WHERE user_id=$1`,[user.id]);
        const ledger=await client.query<{ amount:number }>(`SELECT amount FROM reputation_point_ledger WHERE user_id=$1 AND point_type='kindness' AND source_type='acorn_gift' AND source_key=$2`,[user.id,duplicate.rows[0].id]);
        await client.query("COMMIT");
        return jsonResponse({ sent:true,duplicate:true,balance:duplicate.rows[0].balance,recipientName:duplicate.rows[0].recipientName,kindnessPoints:points.rows[0]?.kindnessPoints || 0,awardedKindnessPoints:ledger.rows[0]?.amount || 0,newStamps:[] });
      }
      const recipient=await client.query<{ id:string;nickname:string }>(
        `SELECT id,nickname FROM users
         WHERE lower(nickname)=lower($1) AND status='active' AND deleted_at IS NULL
           AND lower(COALESCE(email,''))<>$2
         FOR UPDATE`,[nickname,OPERATOR_EMAIL],
      );
      if (!recipient.rows[0]) { await client.query("ROLLBACK"); return errorResponse("선물할 사용자를 찾을 수 없습니다.",404); }
      if (recipient.rows[0].id===user.id) { await client.query("ROLLBACK"); return errorResponse("본인에게는 도토리를 선물할 수 없습니다.",409); }
      await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1),($2) ON CONFLICT(user_id) DO NOTHING`,[user.id,recipient.rows[0].id]);
      const wallets=await client.query<{ userId:string;balance:number }>(`SELECT user_id AS "userId",balance FROM acorn_wallets WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE`,[[user.id,recipient.rows[0].id]]);
      const senderWallet=wallets.rows.find((wallet) => wallet.userId===user.id);
      const recipientWallet=wallets.rows.find((wallet) => wallet.userId===recipient.rows[0].id);
      if (!senderWallet || senderWallet.balance<amount) { await client.query("ROLLBACK"); return errorResponse("보유한 도토리가 부족합니다.",409); }
      const pendingTotal=await client.query<{ amount:number }>(`SELECT COALESCE(sum(amount),0)::int AS amount FROM acorn_gifts WHERE recipient_id=$1 AND status='pending'`,[recipient.rows[0].id]);
      if (!recipientWallet || recipientWallet.balance+(pendingTotal.rows[0]?.amount || 0)+amount>ACORN_LIMIT) { await client.query("ROLLBACK"); return errorResponse("받는 분의 도토리 보관 한도를 초과합니다.",409); }
      const giftMessage=message || `${user.nickname}님이 ${recipient.rows[0].nickname}님에게 도토리 ${amount.toLocaleString()}개를 보냈어요!`;
      const gift=await client.query<{ id:string }>(
        `INSERT INTO acorn_gifts(sender_id,recipient_id,amount,message,request_key,gift_type,status)
         VALUES($1,$2,$3,$4,$5::uuid,'user','pending') RETURNING id`,
        [user.id,recipient.rows[0].id,amount,giftMessage,requestKey],
      );
      await client.query(`UPDATE acorn_wallets SET balance=balance-$2,updated_at=now() WHERE user_id=$1`,[user.id,amount]);
      await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES ($1,$2*-1,'gift_sent',$3,$4)`,[user.id,amount,gift.rows[0].id,`${recipient.rows[0].nickname}님에게 보낸 도토리 선물`]);
      await client.query(`INSERT INTO user_reputation_points(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
      const earnedKindnessPoints=amount/10;
      const currentReputation=await client.query<{ kindnessPoints:number }>(`SELECT kindness_points AS "kindnessPoints" FROM user_reputation_points WHERE user_id=$1 FOR UPDATE`,[user.id]);
      const awardedKindnessPoints=Math.min(earnedKindnessPoints,Math.max(0,20000-(currentReputation.rows[0]?.kindnessPoints || 0)));
      const pointEntry=awardedKindnessPoints>0 ? await client.query(`INSERT INTO reputation_point_ledger(user_id,point_type,amount,source_type,source_key,description) VALUES($1,'kindness',$2,'acorn_gift',$3,'도토리 선물 선행 포인트') ON CONFLICT(user_id,point_type,source_type,source_key) DO NOTHING RETURNING id`,[user.id,awardedKindnessPoints,gift.rows[0].id]) : { rows:[] };
      const reputation=pointEntry.rows[0]
        ? await client.query<{ kindnessPoints:number }>(`UPDATE user_reputation_points SET kindness_points=kindness_points+$2,updated_at=now() WHERE user_id=$1 RETURNING kindness_points AS "kindnessPoints"`,[user.id,awardedKindnessPoints])
        : await client.query<{ kindnessPoints:number }>(`SELECT kindness_points AS "kindnessPoints" FROM user_reputation_points WHERE user_id=$1`,[user.id]);
      await client.query("COMMIT");
      return jsonResponse({ sent:true,balance:senderWallet.balance-amount,recipientName:recipient.rows[0].nickname,kindnessPoints:reputation.rows[0]?.kindnessPoints || 0,awardedKindnessPoints,newStamps:[] },{ status:201 });
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch(error) {
    if (error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    console.error("[acorn-gifts] failed to send",error);
    return errorResponse("도토리 선물을 보내지 못했습니다.",500);
  }
}

async function claimGift(userId:string,giftId:string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(giftId)) return errorResponse("수령할 선물을 확인해 주세요.");
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const result=await client.query<{ id:string;amount:number;status:"pending"|"claimed";senderName:string }>(
      `SELECT gifts.id,gifts.amount,gifts.status,
        COALESCE(sender.nickname,gifts.sender_display_name,'modudadam') AS "senderName"
       FROM acorn_gifts gifts LEFT JOIN users sender ON sender.id=gifts.sender_id
       WHERE gifts.id=$1::uuid AND gifts.recipient_id=$2
       FOR UPDATE OF gifts`,[giftId,userId],
    );
    const gift=result.rows[0];
    if (!gift) { await client.query("ROLLBACK");return errorResponse("수령할 선물을 찾을 수 없습니다.",404); }
    if (gift.status!=="pending") { await client.query("ROLLBACK");return errorResponse("이미 수령한 선물입니다.",409); }
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[userId]);
    const currentBalance=wallet.rows[0]?.balance || 0;
    if (currentBalance+gift.amount>ACORN_LIMIT) { await client.query("ROLLBACK");return errorResponse("도토리 보관 한도가 부족해 선물을 받을 수 없습니다.",409); }
    await client.query(`UPDATE acorn_wallets SET balance=balance+$2,updated_at=now() WHERE user_id=$1`,[userId,gift.amount]);
    await client.query(`UPDATE acorn_gifts SET status='claimed',claimed_at=now() WHERE id=$1`,[gift.id]);
    await client.query(
      `INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description)
       VALUES($1,$2,'gift_received',$3,$4)`,
      [userId,gift.amount,gift.id,`${gift.senderName}님에게 받은 도토리 선물`],
    );
    await client.query("COMMIT");
    return jsonResponse({ claimed:true,balance:currentBalance+gift.amount,amount:gift.amount,senderName:gift.senderName });
  } catch(error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
