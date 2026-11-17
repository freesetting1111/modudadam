import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest, context: RouteContext<"/api/posts/[postId]/like">) {
  try {
    const user = await requireSessionUser(request);
    const { postId } = await context.params;
    const { enabled = true } = await request.json().catch(() => ({ enabled: true })) as { enabled?: boolean };
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const target = await client.query("SELECT 1 FROM posts WHERE id=$1 AND status='published' FOR UPDATE", [postId]);
      if (!target.rows[0]) { await client.query("ROLLBACK"); return errorResponse("글을 찾을 수 없습니다.", 404); }
      if (enabled) {
        await client.query("INSERT INTO post_reactions(post_id,user_id,reaction) VALUES($1,$2,'like') ON CONFLICT DO NOTHING", [postId,user.id]);
      } else {
        await client.query("DELETE FROM post_reactions WHERE post_id=$1 AND user_id=$2 AND reaction='like'", [postId,user.id]);
      }
      const state = await client.query<{ count: number; liked: boolean }>(
        `SELECT COUNT(*)::int AS count,BOOL_OR(user_id=$2) AS liked
           FROM post_reactions WHERE post_id=$1 AND reaction='like'`, [postId,user.id]);
      await client.query("UPDATE posts SET reaction_count=$2,updated_at=NOW() WHERE id=$1", [postId,state.rows[0]?.count || 0]);
      await client.query("COMMIT");
      return jsonResponse({ liked: Boolean(state.rows[0]?.liked), likeCount: state.rows[0]?.count || 0 });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("좋아요 상태를 변경하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
