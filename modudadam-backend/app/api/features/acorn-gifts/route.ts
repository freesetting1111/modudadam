import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

type GiftRow = {
  id:string; direction:"sent"|"received"; amount:number; message:string|null;
  partnerName:string; partnerStampEmoji:string|null; createdAt:string;
};

export async function GET(request:NextRequest) {
  try {
    const user=await requireSessionUser(request);
    const nickname=request.nextUrl.searchParams.get("nickname")?.trim();
    if (nickname) {
      if (nickname.length>60) return errorResponse("닉네임을 확인해 주세요.");
      const recipient=await query<{ nickname:string;stampEmoji:string|null }>(
        `SELECT users.nickname,user_stamp_emoji(users.id) AS "stampEmoji"
         FROM users WHERE lower(users.nickname)=lower($1) AND users.status='active' AND users.deleted_at IS NULL AND users.id<>$2`,
        [nickname,user.id],
      );
      if (!recipient.rows[0]) return errorResponse("선물할 사용자를 찾을 수 없습니다.",404);
      return jsonResponse({ recipient:recipient.rows[0] });
    }

    await query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
    const [wallet,gifts]=await Promise.all([
      query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1`,[user.id]),
      query<GiftRow>(
        `SELECT gifts.id,
          CASE WHEN gifts.sender_id=$1 THEN 'sent' ELSE 'received' END AS direction,
          gifts.amount,gifts.message,
          partner.nickname AS "partnerName",user_stamp_emoji(partner.id) AS "partnerStampEmoji",
          gifts.created_at AS "createdAt"
         FROM acorn_gifts gifts
         JOIN users partner ON partner.id=CASE WHEN gifts.sender_id=$1 THEN gifts.recipient_id ELSE gifts.sender_id END
         WHERE gifts.sender_id=$1 OR gifts.recipient_id=$1
         ORDER BY gifts.created_at DESC LIMIT 20`,[user.id]),
    ]);
    return jsonResponse({ balance:wallet.rows[0]?.balance || 0,gifts:gifts.rows });
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
    const nickname=String(body.nickname || "").trim();
    const amount=Number(body.amount);
    const message=String(body.message || "").trim();
    const requestKey=String(body.requestKey || "");
    if (!nickname || nickname.length>60) return errorResponse("받는 분의 닉네임을 입력해 주세요.");
    if (!Number.isInteger(amount) || amount<1 || amount>9999) return errorResponse("선물할 도토리는 1개 이상 입력해 주세요.");
    if (message.length>80) return errorResponse("메시지는 80자까지 입력할 수 있습니다.");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey)) return errorResponse("선물 요청 정보가 올바르지 않습니다.");

    const client=await db.connect();
    try {
      await client.query("BEGIN");
      const duplicate=await client.query<{ id:string;recipientName:string;balance:number }>(`SELECT gifts.id,recipient.nickname AS "recipientName",wallet.balance FROM acorn_gifts gifts JOIN users recipient ON recipient.id=gifts.recipient_id JOIN acorn_wallets wallet ON wallet.user_id=gifts.sender_id WHERE gifts.sender_id=$1 AND gifts.request_key=$2::uuid`,[user.id,requestKey]);
      if (duplicate.rows[0]) { await client.query("COMMIT"); return jsonResponse({ sent:true,duplicate:true,balance:duplicate.rows[0].balance,recipientName:duplicate.rows[0].recipientName }); }
      const recipient=await client.query<{ id:string;nickname:string }>(`SELECT id,nickname FROM users WHERE lower(nickname)=lower($1) AND status='active' AND deleted_at IS NULL FOR UPDATE`,[nickname]);
      if (!recipient.rows[0]) { await client.query("ROLLBACK"); return errorResponse("선물할 사용자를 찾을 수 없습니다.",404); }
      if (recipient.rows[0].id===user.id) { await client.query("ROLLBACK"); return errorResponse("나에게는 도토리를 선물할 수 없습니다.",409); }
      await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1),($2) ON CONFLICT(user_id) DO NOTHING`,[user.id,recipient.rows[0].id]);
      const wallets=await client.query<{ userId:string;balance:number }>(`SELECT user_id AS "userId",balance FROM acorn_wallets WHERE user_id=ANY($1::uuid[]) ORDER BY user_id FOR UPDATE`,[[user.id,recipient.rows[0].id]]);
      const senderWallet=wallets.rows.find((wallet) => wallet.userId===user.id);
      const recipientWallet=wallets.rows.find((wallet) => wallet.userId===recipient.rows[0].id);
      if (!senderWallet || senderWallet.balance<amount) { await client.query("ROLLBACK"); return errorResponse("보유한 도토리가 부족합니다.",409); }
      if (!recipientWallet || recipientWallet.balance+amount>9999) { await client.query("ROLLBACK"); return errorResponse("받는 분의 도토리 보관 한도를 초과합니다.",409); }
      const gift=await client.query<{ id:string }>(`INSERT INTO acorn_gifts(sender_id,recipient_id,amount,message,request_key) VALUES($1,$2,$3,$4,$5::uuid) RETURNING id`,[user.id,recipient.rows[0].id,amount,message || null,requestKey]);
      await client.query(`UPDATE acorn_wallets SET balance=balance-$2,updated_at=now() WHERE user_id=$1`,[user.id,amount]);
      await client.query(`UPDATE acorn_wallets SET balance=balance+$2,updated_at=now() WHERE user_id=$1`,[recipient.rows[0].id,amount]);
      await client.query(`INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description) VALUES ($1,$3*-1,'gift_sent',$4,$5),($2,$3,'gift_received',$4,$6)`,[user.id,recipient.rows[0].id,amount,gift.rows[0].id,`${recipient.rows[0].nickname}님에게 보낸 도토리 선물`,`${user.nickname}님에게 받은 도토리 선물`]);
      await client.query("COMMIT");
      return jsonResponse({ sent:true,balance:senderWallet.balance-amount,recipientName:recipient.rows[0].nickname },{ status:201 });
    } catch(error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
  } catch(error) {
    if (error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    console.error("[acorn-gifts] failed to send",error);
    return errorResponse("도토리 선물을 보내지 못했습니다.",500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
