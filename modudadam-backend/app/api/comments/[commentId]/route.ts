import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { commentId } = await params;
    const body = await request.json();
    const content = String(body.content || "").trim();
    if (!content || content.length > 3000) return errorResponse("댓글은 1~3,000자로 입력해 주세요.");
    const result = await db.query<{ id: string }>(
      `UPDATE comments SET content=$3,updated_at=now()
       WHERE id=$1 AND author_id=$2 AND status='published' RETURNING id`,
      [commentId, user.id, content],
    );
    return result.rows[0] ? jsonResponse({ id: commentId }) : errorResponse("수정 권한이 없거나 댓글이 없습니다.", 404);
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("댓글을 수정하지 못했습니다.", 500);
  }
}

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
