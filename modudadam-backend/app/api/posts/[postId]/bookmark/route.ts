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
    const post = await query("SELECT 1 FROM posts WHERE id=$1 AND status='published'", [postId]);
    if (!post.rows[0]) return errorResponse("글을 찾을 수 없습니다.", 404);
    if (enabled) {
      await query("INSERT INTO post_bookmarks(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [postId, user.id]);
    } else {
      await query("DELETE FROM post_bookmarks WHERE post_id=$1 AND user_id=$2", [postId, user.id]);
    }
    const count = await query<{ count: number }>("SELECT count(*)::int AS count FROM post_bookmarks WHERE post_id=$1", [postId]);
    return jsonResponse({ bookmarked: enabled, bookmarkCount: count.rows[0]?.count || 0 });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("스크랩 상태를 변경하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
