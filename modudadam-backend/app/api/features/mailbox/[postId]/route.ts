import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { getOrCreateMailboxAlias } from "@/domains/features/mailbox-alias";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { db, query } from "@/lib/db";

const REPLIES = {
  cheer: "응원해요", understand: "이해해요", helpful: "도움이 됐어요",
  empathy: "공감합니다", thanks: "마음을 나눠줘서 고마워요", together: "함께할게요",
  heavy: "마음이 많이 무거웠겠어요", upset: "많이 속상했겠어요", listen: "판단하지 않고 들을게요",
  respect: "그 선택을 존중해요", slowly: "천천히 해도 괜찮아요", not_alone: "혼자가 아니에요",
  no_answer: "지금은 답을 찾지 않아도 괜찮아요", sorry: "그런 일을 겪었다니 마음이 아파요",
  courage: "이야기해 준 용기가 대단해요", rest: "오늘은 마음부터 쉬어가도 괜찮아요",
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
      const exists = await client.query<{ authorId: string }>(`SELECT author_id::text AS "authorId" FROM mailbox_posts WHERE id=$1 AND status='published' FOR UPDATE`, [postId]);
      if (!exists.rows[0]) throw new Error("NOT_FOUND");
      if (exists.rows[0].authorId === user.id) throw new Error("SELF_REPLY");
      let participant = await client.query<{ anonymousAlias: string }>(
        `SELECT anonymous_alias AS "anonymousAlias" FROM mailbox_participants WHERE post_id=$1 AND user_id=$2`, [postId, user.id],
      );
      if (!participant.rows[0]) {
        const alias = await getOrCreateMailboxAlias(client,user.id);
        participant = await client.query<{ anonymousAlias: string }>(
          `INSERT INTO mailbox_participants(post_id,user_id,anonymous_alias) VALUES($1,$2,$3)
           ON CONFLICT DO NOTHING RETURNING anonymous_alias AS "anonymousAlias"`, [postId, user.id, alias],
        );
        if (!participant.rows[0]) participant = await client.query<{ anonymousAlias: string }>(
          `SELECT anonymous_alias AS "anonymousAlias" FROM mailbox_participants WHERE post_id=$1 AND user_id=$2`, [postId, user.id],
        );
      }
      if (!participant.rows[0]) throw new Error("ALIAS_FAILED");
      const current = await client.query<{ id: string; replyType: string | null }>(
        `SELECT id,reply_type AS "replyType" FROM mailbox_comments
          WHERE post_id=$1 AND participant_user_id=$2 AND status='published' FOR UPDATE`, [postId,user.id],
      );
      if (current.rows[0]?.replyType === replyType) throw new Error("SAME_REPLY");
      const saved = current.rows[0]
        ? await client.query(
          `UPDATE mailbox_comments SET content=$3,reply_type=$4,updated_at=now()
            WHERE id=$1 AND participant_user_id=$2
            RETURNING id,content,reply_type AS "replyType",created_at AS "createdAt"`,
          [current.rows[0].id,user.id,content,replyType],
        )
        : await client.query(
          `INSERT INTO mailbox_comments(post_id,participant_user_id,content,reply_type) VALUES($1,$2,$3,$4)
           RETURNING id,content,reply_type AS "replyType",created_at AS "createdAt"`, [postId,user.id,content,replyType],
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
    if (error instanceof Error && error.message === "SELF_REPLY") return errorResponse("내가 작성한 사연에는 답장을 보낼 수 없습니다.", 409);
    if (error instanceof Error && error.message === "SAME_REPLY") return errorResponse("이미 같은 마음을 전했어요. 다른 답장으로 바꿀 수 있습니다.", 409);
    return errorResponse("익명 답장을 등록하지 못했습니다.", 500);
  }
}

function isUuid(value: string) { return /^[0-9a-f-]{36}$/i.test(value); }
export function OPTIONS() { return corsPreflightResponse(); }
