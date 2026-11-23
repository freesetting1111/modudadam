import type { NextRequest } from "next/server";
import { db, query } from "@/lib/db";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const user = await getSessionUser(request);
  const requestedPage = Number(request.nextUrl.searchParams.get("page") || 1);
  const requestedPageSize = Number(request.nextUrl.searchParams.get("pageSize") || 20);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const pageSize = Number.isFinite(requestedPageSize) ? Math.min(20, Math.max(1, Math.floor(requestedPageSize))) : 20;
  const counts = await query<{ rootCount: number; commentCount: number }>(
    `SELECT COUNT(*) FILTER(WHERE parent_id IS NULL)::int AS "rootCount",
            COUNT(*) FILTER(WHERE status='published')::int AS "commentCount"
       FROM comments
      WHERE post_id=$1 AND status IN ('published','deleted')`,
    [postId],
  );
  const rootCount = counts.rows[0]?.rootCount || 0;
  const totalPages = Math.max(1, Math.ceil(rootCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const roots = await query<{ id: string }>(
    `SELECT id FROM comments
      WHERE post_id=$1 AND parent_id IS NULL AND status IN ('published','deleted')
      ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`,
    [postId, pageSize, (currentPage - 1) * pageSize],
  );
  const rootIds = roots.rows.map((root) => root.id);
  if (rootIds.length === 0) {
    return jsonResponse({ comments: [], pagination: { page: currentPage, pageSize, totalItems: rootCount, totalPages, commentCount: counts.rows[0]?.commentCount || 0 } });
  }
  const result = await query(
    `SELECT comments.id,comments.parent_id AS "parentId",comments.reply_to_id AS "replyToId",comments.status,
      CASE WHEN comments.status='deleted' THEN '삭제된 댓글입니다.' ELSE comments.content END AS content,
      comments.created_at AS "createdAt",comments.updated_at AS "updatedAt",
      CASE WHEN categories.code='anonymous' THEN NULL ELSE users.id END AS "authorId",
      CASE WHEN categories.code='anonymous' THEN '익명' ELSE users.nickname END AS "authorName",
      CASE WHEN categories.code='anonymous' THEN NULL ELSE user_stamp_emoji(users.id) END AS "authorStampEmoji",
      CASE WHEN categories.code='anonymous' AND reply_users.id IS NOT NULL THEN '익명' ELSE reply_users.nickname END AS "replyToAuthor",
      CASE WHEN categories.code='anonymous' THEN NULL ELSE user_stamp_emoji(reply_users.id) END AS "replyToStampEmoji",
      (comments.author_id=$2::uuid AND comments.status='published') AS "canDelete",
      (comments.author_id=$2::uuid AND comments.status='published') AS "canEdit",
      ($2::uuid IS NOT NULL AND comments.author_id<>$2::uuid AND comments.status='published') AS "canReport",
      comments.like_count AS "likeCount",
      comments.dislike_count AS "dislikeCount",
      my_reaction.reaction AS "myReaction",
      (bounty.accepted_comment_id=comments.id) AS "isBountyWinner",
      (posts.author_id=$2::uuid AND comments.author_id<>$2::uuid AND comments.parent_id IS NULL
        AND comments.status='published' AND bounty.status='open' AND bounty.expires_at>now()) AS "canReceiveBounty",
      CASE WHEN categories.code='anonymous' THEN 0 ELSE COALESCE(help.score,0) END AS "helpScore",
      CASE WHEN categories.code='anonymous' THEN 0 ELSE COALESCE(help.accepted_answers,0) END AS "acceptedAnswers"
     FROM comments
     JOIN users ON users.id=comments.author_id
     JOIN posts ON posts.id=comments.post_id
     JOIN categories ON categories.id=posts.category_id
     LEFT JOIN post_acorn_bounties bounty ON bounty.post_id=posts.id
     LEFT JOIN user_help_reputation help ON help.user_id=comments.author_id
     LEFT JOIN comments reply_target ON reply_target.id=comments.reply_to_id
     LEFT JOIN users reply_users ON reply_users.id=reply_target.author_id
     LEFT JOIN comment_reactions my_reaction
       ON my_reaction.comment_id=comments.id AND my_reaction.user_id=$2::uuid
     WHERE comments.post_id=$1 AND comments.status IN ('published','deleted')
       AND (comments.id=ANY($3::uuid[]) OR comments.parent_id=ANY($3::uuid[]))
     ORDER BY comments.created_at ASC,comments.id ASC`,
    [postId, user?.id || null, rootIds],
  );
  const order = new Map(rootIds.map((id, index) => [id, index]));
  result.rows.sort((left, right) => {
    const leftRoot = left.parentId || left.id;
    const rightRoot = right.parentId || right.id;
    const rootDifference = (order.get(leftRoot) ?? 0) - (order.get(rightRoot) ?? 0);
    if (rootDifference !== 0) return rootDifference;
    if (!left.parentId) return -1;
    if (!right.parentId) return 1;
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
  return jsonResponse({ comments: result.rows, pagination: { page: currentPage, pageSize, totalItems: rootCount, totalPages, commentCount: counts.rows[0]?.commentCount || 0 } });
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
      let replyToId: string | null = null;
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
        replyToId = parentId;
      }
      const comment = await client.query<{ id: string }>(
        "INSERT INTO comments(post_id,author_id,parent_id,reply_to_id,content) VALUES($1,$2,$3,$4,$5) RETURNING id",
        [postId, user.id, rootParentId, replyToId, content],
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
