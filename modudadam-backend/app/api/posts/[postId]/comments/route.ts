import type { NextRequest } from "next/server";
import { db, query } from "@/lib/db";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const user = await getSessionUser(request);
  const result = await query(
    `SELECT comments.id,comments.parent_id AS "parentId",comments.status,
      CASE WHEN comments.status='deleted' THEN '삭제된 댓글입니다.' ELSE comments.content END AS content,
      comments.created_at AS "createdAt",comments.updated_at AS "updatedAt",
      users.id AS "authorId",COALESCE(local_account.login_id,users.nickname) AS "authorName",
      (comments.author_id=$2::uuid AND comments.status='published') AS "canDelete"
     FROM comments JOIN users ON users.id=comments.author_id
     LEFT JOIN user_local_accounts local_account ON local_account.user_id=users.id
     WHERE comments.post_id=$1 AND comments.status IN ('published','deleted')
     ORDER BY comments.created_at ASC,comments.id ASC`,
    [postId, user?.id || null],
  );
  return jsonResponse({ comments: result.rows });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { postId } = await params;
    const body = await request.json();
    const content = String(body.content || "").trim();
    const parentId = body.parentId ? String(body.parentId) : null;
    if (!content || content.length > 3000) return errorResponse("댓글은 1~3,000자로 입력해 주세요.");

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const post = await client.query("SELECT id FROM posts WHERE id=$1 AND status='published' FOR UPDATE", [postId]);
      if (!post.rows[0]) {
        await client.query("ROLLBACK");
        return errorResponse("글을 찾을 수 없습니다.", 404);
      }
      let rootParentId: string | null = null;
      if (parentId) {
        const parent = await client.query<{ root_parent_id: string }>(
          `SELECT COALESCE(parent_id,id) AS root_parent_id FROM comments
           WHERE id=$1 AND post_id=$2 AND status='published'`,
          [parentId, postId],
        );
        if (!parent.rows[0]) {
          await client.query("ROLLBACK");
          return errorResponse("답글을 작성할 댓글을 찾을 수 없습니다.", 404);
        }
        rootParentId = parent.rows[0].root_parent_id;
      }
      const comment = await client.query<{ id: string }>(
        "INSERT INTO comments(post_id,author_id,parent_id,content) VALUES($1,$2,$3,$4) RETURNING id",
        [postId, user.id, rootParentId, content],
      );
      await client.query("UPDATE posts SET comment_count=comment_count+1,updated_at=now() WHERE id=$1", [postId]);
      await client.query("COMMIT");
      return jsonResponse({ id: comment.rows[0].id }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("댓글을 저장하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
