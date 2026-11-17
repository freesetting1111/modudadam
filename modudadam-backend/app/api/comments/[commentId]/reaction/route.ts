import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest, context: RouteContext<"/api/comments/[commentId]/reaction">) {
  try {
    const user = await requireSessionUser(request);
    const { commentId } = await context.params;
    const { reaction } = await request.json() as { reaction?: "like" | "dislike" };
    if (reaction !== "like" && reaction !== "dislike") return errorResponse("댓글 반응 값이 올바르지 않습니다.");
    const result = await query<{ found: boolean; likeCount: number; dislikeCount: number; myReaction: "like" | "dislike" | null }>(
      `WITH target AS (
         SELECT id FROM comments WHERE id=$1 AND status='published'
       ), current AS (
         SELECT reaction FROM comment_reactions WHERE comment_id=$1 AND user_id=$2
       ), desired AS (
         SELECT target.id,
                (SELECT reaction FROM current) AS old_reaction,
                CASE WHEN (SELECT reaction FROM current)=$3 THEN NULL ELSE $3::varchar END AS next_reaction
         FROM target
       ), upserted AS (
         INSERT INTO comment_reactions(comment_id,user_id,reaction)
         SELECT id,$2,next_reaction FROM desired WHERE next_reaction IS NOT NULL
         ON CONFLICT(comment_id,user_id) DO UPDATE SET reaction=EXCLUDED.reaction,updated_at=NOW()
         RETURNING 1
       ), removed AS (
         DELETE FROM comment_reactions reactions USING desired
         WHERE reactions.comment_id=desired.id AND reactions.user_id=$2 AND desired.next_reaction IS NULL
         RETURNING 1
       ), delta AS (
         SELECT desired.*,
                (SELECT COUNT(*) FROM upserted) AS upsert_count,
                (SELECT COUNT(*) FROM removed) AS remove_count
         FROM desired
       ), updated AS (
         UPDATE comments SET
           like_count=GREATEST(0,like_count
             - CASE WHEN delta.old_reaction='like' THEN 1 ELSE 0 END
             + CASE WHEN delta.next_reaction='like' THEN 1 ELSE 0 END),
           dislike_count=GREATEST(0,dislike_count
             - CASE WHEN delta.old_reaction='dislike' THEN 1 ELSE 0 END
             + CASE WHEN delta.next_reaction='dislike' THEN 1 ELSE 0 END)
         FROM delta WHERE comments.id=delta.id
         RETURNING comments.like_count,comments.dislike_count,delta.next_reaction
       )
       SELECT EXISTS(SELECT 1 FROM target) AS found,
              COALESCE((SELECT like_count FROM updated),0)::int AS "likeCount",
              COALESCE((SELECT dislike_count FROM updated),0)::int AS "dislikeCount",
              (SELECT next_reaction FROM updated) AS "myReaction"`,
      [commentId, user.id, reaction],
    );
    const state = result.rows[0];
    if (!state?.found) return errorResponse("댓글을 찾을 수 없습니다.", 404);
    return jsonResponse({ commentId, likeCount: state.likeCount,
      dislikeCount: state.dislikeCount, myReaction: state.myReaction });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("댓글 반응을 변경하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
