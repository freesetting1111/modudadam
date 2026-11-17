import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSessionUser, SESSION_COOKIE } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const reasons = new Set(["content_lack", "low_usage", "privacy_concern", "usability", "other"]);

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const reason = String(body.reason || "").trim();
    const reasonDetail = String(body.reasonDetail || "").trim().slice(0, 500);
    if (body.acknowledged !== true) return errorResponse("탈퇴 안내 확인과 동의가 필요합니다.");
    if (!reasons.has(reason)) return errorResponse("탈퇴 사유를 선택해 주세요.");
    if (reason === "other" && !reasonDetail) return errorResponse("기타 탈퇴 사유를 입력해 주세요.");

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query(
        "SELECT id FROM users WHERE id=$1 AND status='active' AND deleted_at IS NULL FOR UPDATE",
        [user.id],
      );
      if (!locked.rows[0]) throw new Error("ALREADY_WITHDRAWN");

      await client.query(
        `INSERT INTO user_withdrawals(user_id,reason_code,reason_detail)
         VALUES($1,$2,$3)`,
        [user.id, reason, reason === "other" ? reasonDetail : null],
      );

      await client.query("DELETE FROM post_bookmarks WHERE user_id=$1", [user.id]);
      await client.query(
        `WITH affected AS (
           DELETE FROM post_reactions WHERE user_id=$1 RETURNING post_id
         )
         UPDATE posts SET reaction_count=(
           SELECT COUNT(*)::int FROM post_reactions reaction
           WHERE reaction.post_id=posts.id AND reaction.reaction='like'
         )
         WHERE posts.id IN (SELECT post_id FROM affected)`,
        [user.id],
      );
      await client.query("DELETE FROM comment_reactions WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM user_records WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM account_recovery_codes WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM profile_email_verifications WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM user_consents WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM user_local_accounts WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM user_oauth_accounts WHERE user_id=$1", [user.id]);
      await client.query("UPDATE user_sessions SET revoked_at=COALESCE(revoked_at,NOW()) WHERE user_id=$1", [user.id]);
      await client.query("UPDATE access_logs SET user_id=NULL WHERE user_id=$1", [user.id]);
      await client.query("UPDATE search_logs SET user_id=NULL WHERE user_id=$1", [user.id]);
      await client.query("DELETE FROM visitor_presence WHERE user_id=$1", [user.id]);
      await client.query("UPDATE event_entry_tickets SET user_id=NULL WHERE user_id=$1", [user.id]);
      await client.query("UPDATE event_sessions SET user_id=NULL,expires_at=LEAST(expires_at,NOW()) WHERE user_id=$1", [user.id]);

      await client.query(
        `UPDATE users SET
           nickname='탈퇴한 사용자',email=NULL,avatar_url=NULL,real_name=NULL,phone_number=NULL,
           phone_verified_at=NULL,status_message=NULL,gender=NULL,age_range=NULL,email_verified_at=NULL,
           status='withdrawn',deleted_at=NOW(),updated_at=NOW()
         WHERE id=$1`,
        [user.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const response = jsonResponse({ withdrawn: true });
    response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "ALREADY_WITHDRAWN") return errorResponse("이미 탈퇴 처리된 계정입니다.", 409);
    console.error("[withdrawal] failed", error);
    return errorResponse("회원탈퇴를 처리하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
