import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest, context: RouteContext<"/api/comments/[commentId]/reaction">) {
  try {
    const user = await requireSessionUser(request);
    const { commentId } = await context.params;
    const { reaction } = await request.json() as { reaction?: "like" | "dislike" };
    if (reaction !== "like" && reaction !== "dislike") return errorResponse("댓글 반응 값이 올바르지 않습니다.");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const target = await client.query("SELECT 1 FROM comments WHERE id=$1 AND status='published' FOR UPDATE", [commentId]);
      if (!target.rows[0]) { await client.query("ROLLBACK"); return errorResponse("댓글을 찾을 수 없습니다.", 404); }
      const current = await client.query<{ reaction: "like" | "dislike" }>(
        "SELECT reaction FROM comment_reactions WHERE comment_id=$1 AND user_id=$2", [commentId,user.id]);
      if (current.rows[0]?.reaction === reaction) {
        await client.query("DELETE FROM comment_reactions WHERE comment_id=$1 AND user_id=$2", [commentId,user.id]);
      } else {
        await client.query(
          `INSERT INTO comment_reactions(comment_id,user_id,reaction) VALUES($1,$2,$3)
           ON CONFLICT(comment_id,user_id) DO UPDATE SET reaction=EXCLUDED.reaction,updated_at=NOW()`,
          [commentId,user.id,reaction]);
      }
      const state = await client.query<{ like_count: number; dislike_count: number; my_reaction: "like" | "dislike" | null }>(
        `SELECT COUNT(*) FILTER(WHERE reaction='like')::int AS like_count,
                COUNT(*) FILTER(WHERE reaction='dislike')::int AS dislike_count,
                MAX(reaction) FILTER(WHERE user_id=$2) AS my_reaction
           FROM comment_reactions WHERE comment_id=$1`, [commentId,user.id]);
      await client.query("COMMIT");
      return jsonResponse({ commentId, likeCount: state.rows[0]?.like_count || 0,
        dislikeCount: state.rows[0]?.dislike_count || 0, myReaction: state.rows[0]?.my_reaction || null });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("댓글 반응을 변경하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
