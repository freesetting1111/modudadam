import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest, context: RouteContext<"/api/posts/[postId]/like">) {
  try {
    const user = await requireSessionUser(request);
    const { postId } = await context.params;
    const { enabled = true } = await request.json().catch(() => ({ enabled: true })) as { enabled?: boolean };
    const result = await query<{ found: boolean; liked: boolean; likeCount: number }>(
      `WITH target AS (
         SELECT id FROM posts WHERE id=$1 AND status='published'
       ), inserted AS (
         INSERT INTO post_reactions(post_id,user_id,reaction)
         SELECT id,$2,'like' FROM target WHERE $3::boolean
         ON CONFLICT DO NOTHING RETURNING 1
       ), removed AS (
         DELETE FROM post_reactions
         WHERE post_id=$1 AND user_id=$2 AND reaction='like' AND NOT $3::boolean
         RETURNING 1
       ), updated AS (
         UPDATE posts SET reaction_count=GREATEST(0,reaction_count
           + (SELECT COUNT(*) FROM inserted) - (SELECT COUNT(*) FROM removed))
         FROM target WHERE posts.id=target.id RETURNING posts.reaction_count
       )
       SELECT EXISTS(SELECT 1 FROM target) AS found,
              ($3::boolean AND EXISTS(SELECT 1 FROM target)) AS liked,
              COALESCE((SELECT reaction_count FROM updated),0)::int AS "likeCount"`,
      [postId, user.id, enabled],
    );
    const state = result.rows[0];
    if (!state?.found) return errorResponse("글을 찾을 수 없습니다.", 404);
    return jsonResponse({ liked: state.liked, likeCount: state.likeCount });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("좋아요 상태를 변경하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
