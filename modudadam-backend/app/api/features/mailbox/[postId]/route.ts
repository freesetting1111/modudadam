import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { createAnonymousAlias } from "@/domains/features/anonymous-alias";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { db, query } from "@/lib/db";

export async function GET(_request: NextRequest, context: RouteContext<"/api/features/mailbox/[postId]">) {
  const { postId } = await context.params;
  if (!isUuid(postId)) return errorResponse("사연 정보가 올바르지 않습니다.");
  const postResult = await query(
    `SELECT id,author_alias AS "authorAlias",title,content,created_at AS "createdAt"
     FROM mailbox_posts WHERE id=$1 AND status='published'`, [postId],
  );
  if (!postResult.rows[0]) return errorResponse("사연을 찾을 수 없습니다.", 404);
  const comments = await query(
    `SELECT comments.id,participants.anonymous_alias AS "authorAlias",comments.content,comments.created_at AS "createdAt"
     FROM mailbox_comments comments JOIN mailbox_participants participants
       ON participants.post_id=comments.post_id AND participants.user_id=comments.participant_user_id
     WHERE comments.post_id=$1 AND comments.status='published' ORDER BY comments.created_at`, [postId],
  );
  return jsonResponse({ post: postResult.rows[0], comments: comments.rows });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/features/mailbox/[postId]">) {
  try {
    const user = await requireSessionUser(request);
    const { postId } = await context.params;
    if (!isUuid(postId)) return errorResponse("사연 정보가 올바르지 않습니다.");
    const body = await request.json();
    const content = String(body.content || "").trim();
    if (!content || content.length > 2000) return errorResponse("답장은 1자 이상 2,000자 이하로 입력해 주세요.");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const exists = await client.query(`SELECT 1 FROM mailbox_posts WHERE id=$1 AND status='published' FOR UPDATE`, [postId]);
      if (!exists.rows[0]) throw new Error("NOT_FOUND");
      let participant = await client.query<{ anonymousAlias: string }>(
        `SELECT anonymous_alias AS "anonymousAlias" FROM mailbox_participants WHERE post_id=$1 AND user_id=$2`, [postId, user.id],
      );
      for (let attempt = 0; !participant.rows[0] && attempt < 8; attempt += 1) {
        const alias = createAnonymousAlias();
        participant = await client.query<{ anonymousAlias: string }>(
          `INSERT INTO mailbox_participants(post_id,user_id,anonymous_alias) VALUES($1,$2,$3)
           ON CONFLICT DO NOTHING RETURNING anonymous_alias AS "anonymousAlias"`, [postId, user.id, alias],
        );
        if (!participant.rows[0]) participant = await client.query<{ anonymousAlias: string }>(
          `SELECT anonymous_alias AS "anonymousAlias" FROM mailbox_participants WHERE post_id=$1 AND user_id=$2`, [postId, user.id],
        );
      }
      if (!participant.rows[0]) throw new Error("ALIAS_FAILED");
      const saved = await client.query(
        `INSERT INTO mailbox_comments(post_id,participant_user_id,content) VALUES($1,$2,$3)
         RETURNING id,content,created_at AS "createdAt"`, [postId, user.id, content],
      );
      await client.query("COMMIT");
      return jsonResponse({ ...saved.rows[0], authorAlias: participant.rows[0].anonymousAlias }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "NOT_FOUND") return errorResponse("사연을 찾을 수 없습니다.", 404);
    return errorResponse("익명 답장을 등록하지 못했습니다.", 500);
  }
}

function isUuid(value: string) { return /^[0-9a-f-]{36}$/i.test(value); }
export function OPTIONS() { return corsPreflightResponse(); }
