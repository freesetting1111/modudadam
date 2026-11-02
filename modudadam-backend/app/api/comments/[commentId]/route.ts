import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { commentId } = await params;
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const comment = await client.query<{ id: string; post_id: string }>(
        `SELECT id,post_id FROM comments
         WHERE id=$1 AND author_id=$2 AND status='published' FOR UPDATE`,
        [commentId, user.id],
      );
      if (!comment.rows[0]) {
        await client.query("ROLLBACK");
        return errorResponse("삭제 권한이 없거나 댓글이 없습니다.", 404);
      }
      await client.query(
        "UPDATE comments SET status='deleted',deleted_at=now(),updated_at=now() WHERE id=$1",
        [commentId],
      );
      await client.query(
        "UPDATE posts SET comment_count=GREATEST(comment_count-1,0),updated_at=now() WHERE id=$1",
        [comment.rows[0].post_id],
      );
      await client.query("COMMIT");
      return jsonResponse({ id: commentId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("댓글을 삭제하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
