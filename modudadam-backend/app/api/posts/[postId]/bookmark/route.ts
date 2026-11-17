import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { postId } = await params;
    const body = await request.json();
    const enabled = body.enabled !== false;
    const result = await query<{ found: boolean; bookmarked: boolean; bookmarkCount: number }>(
      `WITH target AS (
         SELECT id FROM posts WHERE id=$1 AND status='published'
       ), inserted AS (
         INSERT INTO post_bookmarks(post_id,user_id)
         SELECT id,$2 FROM target WHERE $3::boolean
         ON CONFLICT DO NOTHING RETURNING 1
       ), removed AS (
         DELETE FROM post_bookmarks WHERE post_id=$1 AND user_id=$2 AND NOT $3::boolean
         RETURNING 1
       ), updated AS (
         UPDATE posts SET bookmark_count=GREATEST(0,bookmark_count
           + (SELECT COUNT(*) FROM inserted) - (SELECT COUNT(*) FROM removed))
         FROM target WHERE posts.id=target.id RETURNING posts.bookmark_count
       )
       SELECT EXISTS(SELECT 1 FROM target) AS found,
              ($3::boolean AND EXISTS(SELECT 1 FROM target)) AS bookmarked,
              COALESCE((SELECT bookmark_count FROM updated),0)::int AS "bookmarkCount"`,
      [postId, user.id, enabled],
    );
    const state = result.rows[0];
    if (!state?.found) return errorResponse("글을 찾을 수 없습니다.", 404);
    return jsonResponse({ bookmarked: state.bookmarked, bookmarkCount: state.bookmarkCount });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("스크랩 상태를 변경하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
