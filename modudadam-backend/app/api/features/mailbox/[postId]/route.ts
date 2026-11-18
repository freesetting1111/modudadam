import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { createAnonymousAlias } from "@/domains/features/anonymous-alias";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { db, query } from "@/lib/db";

const REPLIES = {
  cheer: "응원해요", understand: "이해해요", helpful: "도움이 됐어요",
  empathy: "공감합니다", thanks: "마음을 나눠줘서 고마워요", together: "함께할게요",
} as const;

export async function GET(request: NextRequest, context: RouteContext<"/api/features/mailbox/[postId]">) {
  const { postId } = await context.params;
  const user = await getSessionUser(request);
  if (!isUuid(postId)) return errorResponse("사연 정보가 올바르지 않습니다.");
  const postResult = await query(
    `SELECT id,author_alias AS "authorAlias",title,content,created_at AS "createdAt"
     FROM mailbox_posts WHERE id=$1 AND status='published'`, [postId],
  );
  if (!postResult.rows[0]) return errorResponse("사연을 찾을 수 없습니다.", 404);
  const comments = await query(
    `SELECT comments.id,participants.anonymous_alias AS "authorAlias",comments.content,
            comments.reply_type AS "replyType",comments.created_at AS "createdAt",
            (comments.participant_user_id=$2::uuid) AS "isMine"
     FROM mailbox_comments comments JOIN mailbox_participants participants
       ON participants.post_id=comments.post_id AND participants.user_id=comments.participant_user_id
     WHERE comments.post_id=$1 AND comments.status='published' ORDER BY comments.created_at`, [postId, user?.id || null],
  );
  const myReply = user ? comments.rows.find((comment: { replyType?: string; isMine?: boolean }) => comment.replyType && comment.isMine) : null;
  return jsonResponse({ post: postResult.rows[0], comments: comments.rows, myReplyType: myReply?.replyType || null });
}

export async function POST(request: NextRequest, context: RouteContext<"/api/features/mailbox/[postId]">) {
  try {
    const user = await requireSessionUser(request);
    const { postId } = await context.params;
    if (!isUuid(postId)) return errorResponse("사연 정보가 올바르지 않습니다.");
    const body = await request.json();
    const replyType = String(body.replyType || "") as keyof typeof REPLIES;
    if (!(replyType in REPLIES)) return errorResponse("답장 문구를 선택해 주세요.");
    const content = REPLIES[replyType];
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
        `INSERT INTO mailbox_comments(post_id,participant_user_id,content,reply_type) VALUES($1,$2,$3,$4)
         RETURNING id,content,reply_type AS "replyType",created_at AS "createdAt"`, [postId, user.id, content, replyType],
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
