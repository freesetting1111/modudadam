import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { requireSessionUser } from "@/domains/auth/session";
import { db } from "@/lib/db";
import { ACORN_WALLET_LIMIT } from "@/lib/acorn-economy";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

type BountyRow={
  id:string;postId:string;sponsorId:string;postTitle:string;amount:number;feeAmount:number;
  awardAmount:number;status:"open"|"awarded"|"refunded";expired:boolean;
};

export async function POST(request:NextRequest,{ params }:{ params:Promise<{ postId:string }> }) {
  try {
    const user=await requireSessionUser(request);
    const { postId }=await params;
    if (!/^[0-9a-f-]{36}$/i.test(postId)) return errorResponse("게시글을 확인해 주세요.");
    const body=await request.json();
    const action=String(body.action || "");
    if (action==="award") return awardBounty(user.id,postId,String(body.commentId || ""));
    if (action==="refund") return refundBounty(user.id,postId);
    return errorResponse("현상금 요청 내용을 확인해 주세요.");
  } catch(error) {
    if (error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    console.error("[post-bounty] failed",error);
    return errorResponse("답변 현상금을 처리하지 못했습니다.",500);
  }
}

async function lockBounty(client:PoolClient,postId:string) {
  const result=await client.query<BountyRow>(
    `SELECT bounty.id,bounty.post_id AS "postId",bounty.sponsor_id AS "sponsorId",posts.title AS "postTitle",
      bounty.amount,bounty.fee_amount AS "feeAmount",bounty.award_amount AS "awardAmount",bounty.status,
      (bounty.expires_at<=now()) AS expired
     FROM post_acorn_bounties bounty JOIN posts ON posts.id=bounty.post_id
     WHERE bounty.post_id=$1 FOR UPDATE OF bounty`,[postId],
  );
  return result.rows[0];
}

async function awardBounty(userId:string,postId:string,commentId:string) {
  if (!/^[0-9a-f-]{36}$/i.test(commentId)) return errorResponse("채택할 답변을 확인해 주세요.");
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const bounty=await lockBounty(client,postId);
    if (!bounty) { await client.query("ROLLBACK");return errorResponse("이 글에는 답변 현상금이 없습니다.",404); }
    if (bounty.sponsorId!==userId) { await client.query("ROLLBACK");return errorResponse("글 작성자만 답변을 채택할 수 있습니다.",403); }
    if (bounty.status!=="open") { await client.query("ROLLBACK");return errorResponse("이미 처리된 현상금입니다.",409); }
    if (bounty.expired) { await client.query("ROLLBACK");return errorResponse("현상금 기간이 끝났습니다. 환불받기를 이용해 주세요.",409); }
    const answer=await client.query<{ authorId:string;authorName:string;anonymous:boolean }>(
      `SELECT comments.author_id AS "authorId",users.nickname AS "authorName",(categories.code='anonymous') AS anonymous
       FROM comments JOIN users ON users.id=comments.author_id
       JOIN posts ON posts.id=comments.post_id JOIN categories ON categories.id=posts.category_id
       WHERE comments.id=$1 AND comments.post_id=$2 AND comments.parent_id IS NULL
         AND comments.status='published' AND comments.author_id<>$3`,[commentId,postId,userId],
    );
    if (!answer.rows[0]) { await client.query("ROLLBACK");return errorResponse("현상금을 지급할 수 있는 답변이 아닙니다.",409); }
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[answer.rows[0].authorId]);
    const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[answer.rows[0].authorId]);
    if ((wallet.rows[0]?.balance || 0)+bounty.awardAmount>ACORN_WALLET_LIMIT) {
      await client.query("ROLLBACK");
      return errorResponse("답변자의 도토리 보관 한도가 부족해 지금은 지급할 수 없습니다.",409);
    }
    await client.query(`UPDATE acorn_wallets SET balance=balance+$2,updated_at=now() WHERE user_id=$1`,[answer.rows[0].authorId,bounty.awardAmount]);
    await client.query(
      `INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description)
       VALUES($1,$2,'bounty_award',$3,$4)`,
      [answer.rows[0].authorId,bounty.awardAmount,bounty.id,`${bounty.postTitle} 답변 채택 현상금`],
    );
    await client.query(`INSERT INTO user_help_reputation(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[answer.rows[0].authorId]);
    const reputation=await client.query(
      `INSERT INTO user_help_reputation_ledger(user_id,amount,source_type,source_key,description)
       VALUES($1,15,'bounty_answer',$2,'답변 현상금 채택') ON CONFLICT(user_id,source_type,source_key) DO NOTHING RETURNING id`,
      [answer.rows[0].authorId,bounty.id],
    );
    if (reputation.rows[0]) await client.query(
      `UPDATE user_help_reputation SET score=score+15,accepted_answers=accepted_answers+1,updated_at=now() WHERE user_id=$1`,
      [answer.rows[0].authorId],
    );
    if (bounty.feeAmount>0) await client.query(
      `INSERT INTO acorn_bounty_burns(bounty_id,amount,reason) VALUES($1,$2,'answer_awarded')`,[bounty.id,bounty.feeAmount],
    );
    await client.query(
      `UPDATE post_acorn_bounties SET status='awarded',accepted_comment_id=$2,recipient_id=$3,awarded_at=now(),updated_at=now() WHERE id=$1`,
      [bounty.id,commentId,answer.rows[0].authorId],
    );
    await client.query("COMMIT");
    return jsonResponse({ awarded:true,recipientName:answer.rows[0].anonymous ? "익명 답변자" : answer.rows[0].authorName,awardAmount:bounty.awardAmount,burnedAmount:bounty.feeAmount });
  } catch(error) { await client.query("ROLLBACK");throw error; } finally { client.release(); }
}

async function refundBounty(userId:string,postId:string) {
  const client=await db.connect();
  try {
    await client.query("BEGIN");
    const bounty=await lockBounty(client,postId);
    if (!bounty) { await client.query("ROLLBACK");return errorResponse("이 글에는 답변 현상금이 없습니다.",404); }
    if (bounty.sponsorId!==userId) { await client.query("ROLLBACK");return errorResponse("글 작성자만 현상금을 환불받을 수 있습니다.",403); }
    if (bounty.status!=="open") { await client.query("ROLLBACK");return errorResponse("이미 처리된 현상금입니다.",409); }
    if (!bounty.expired) { await client.query("ROLLBACK");return errorResponse("현상금 모집 기간이 아직 끝나지 않았습니다.",409); }
    const eligible=await client.query<{ count:number }>(
      `SELECT count(*)::int AS count FROM comments
       WHERE post_id=$1 AND parent_id IS NULL AND status='published' AND author_id<>$2`,[postId,userId],
    );
    const hasAnswers=(eligible.rows[0]?.count || 0)>0;
    const refundAmount=hasAnswers ? bounty.awardAmount : bounty.amount;
    await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[userId]);
    const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[userId]);
    if ((wallet.rows[0]?.balance || 0)+refundAmount>ACORN_WALLET_LIMIT) {
      await client.query("ROLLBACK");return errorResponse("도토리 보관 한도를 비운 뒤 다시 환불받아 주세요.",409);
    }
    await client.query(`UPDATE acorn_wallets SET balance=balance+$2,updated_at=now() WHERE user_id=$1`,[userId,refundAmount]);
    await client.query(
      `INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description)
       VALUES($1,$2,'bounty_refund',$3,$4)`,[userId,refundAmount,bounty.id,hasAnswers ? "미채택 답변 현상금 부분 환불" : "미응답 답변 현상금 전액 환불"],
    );
    if (hasAnswers && bounty.feeAmount>0) await client.query(
      `INSERT INTO acorn_bounty_burns(bounty_id,amount,reason) VALUES($1,$2,'expired_with_answers')`,[bounty.id,bounty.feeAmount],
    );
    await client.query(`UPDATE post_acorn_bounties SET status='refunded',refunded_at=now(),updated_at=now() WHERE id=$1`,[bounty.id]);
    await client.query("COMMIT");
    return jsonResponse({ refunded:true,refundAmount,burnedAmount:hasAnswers ? bounty.feeAmount : 0 });
  } catch(error) { await client.query("ROLLBACK");throw error; } finally { client.release(); }
}

export function OPTIONS(){return corsPreflightResponse();}
