import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { createAnonymousAlias } from "@/domains/features/anonymous-alias";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { db, query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const limit = 20;
  const result = await query(
    `SELECT posts.id,posts.author_alias AS "authorAlias",posts.title,posts.content,posts.created_at AS "createdAt",
       COUNT(comments.id)::int AS "commentCount"
     FROM mailbox_posts posts LEFT JOIN mailbox_comments comments ON comments.post_id=posts.id AND comments.status='published'
     WHERE posts.status='published' GROUP BY posts.id
     ORDER BY posts.created_at DESC LIMIT $1 OFFSET $2`,
    [limit + 1, (page - 1) * limit],
  );
  return jsonResponse({ posts: result.rows.slice(0, limit), page, hasMore: result.rows.length > limit });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    if (!title || title.length > 80) return errorResponse("제목은 1자 이상 80자 이하로 입력해 주세요.");
    if (!content || content.length > 4000) return errorResponse("사연은 1자 이상 4,000자 이하로 입력해 주세요.");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      let post: { id: string; authorAlias: string } | undefined;
      for (let attempt = 0; attempt < 5 && !post; attempt += 1) {
        const alias = createAnonymousAlias();
        const inserted = await client.query<{ id: string; authorAlias: string }>(
          `INSERT INTO mailbox_posts(author_id,author_alias,title,content) VALUES($1,$2,$3,$4)
           RETURNING id,author_alias AS "authorAlias"`, [user.id, alias, title, content],
        );
        post = inserted.rows[0];
      }
      if (!post) throw new Error("ALIAS_FAILED");
      await client.query(
        `INSERT INTO mailbox_participants(post_id,user_id,anonymous_alias) VALUES($1,$2,$3)`,
        [post.id, user.id, post.authorAlias],
      );
      await client.query("COMMIT");
      return jsonResponse(post, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    return errorResponse("익명 사연을 등록하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
