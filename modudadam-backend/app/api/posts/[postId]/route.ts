import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db, query } from "@/lib/db";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { deletePostImage, getPostImageUrl, MAX_POST_IMAGES } from "@/lib/s3";
import { normalizePostContentHtml, renderPostContentHtml } from "@/domains/community/post-content";

type PostImageRow = {
  id: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  byteSize: string;
  sortOrder: number;
};

export async function GET(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const user = await getSessionUser(request);
  let visitorId = request.cookies.get("modudadam_visitor")?.value || "";
  let shouldSetVisitorCookie = false;
  if (!user && !/^[0-9a-f-]{36}$/i.test(visitorId)) {
    visitorId = randomUUID();
    shouldSetVisitorCookie = true;
  }
  if (request.nextUrl.searchParams.get("trackView") !== "false") {
    const viewerKey = user ? `user:${user.id}` : `visitor:${visitorId}`;
    const result = await query(
      `WITH new_view AS (
         INSERT INTO post_views(post_id,viewer_key)
         SELECT id,$2 FROM posts WHERE id=$1 AND status='published'
         ON CONFLICT DO NOTHING
         RETURNING post_id
       )
       UPDATE posts SET view_count=view_count+1
       WHERE id=(SELECT post_id FROM new_view)
       RETURNING id`,
      [postId, viewerKey],
    );
    if (!result.rows[0]) {
      const exists = await query("SELECT 1 FROM posts WHERE id=$1 AND status='published'", [postId]);
      if (!exists.rows[0]) return errorResponse("글을 찾을 수 없습니다.", 404);
    }
  }
  const detail = await query(
    `SELECT posts.id,posts.title,posts.content,posts.attributes,
      posts.post_type AS "postType",posts.view_count AS "viewCount",posts.comment_count AS "commentCount",
      posts.published_at AS "publishedAt",posts.created_at AS "createdAt",posts.updated_at AS "updatedAt",
      categories.code AS "categoryCode",categories.name AS "categoryName",
      CASE WHEN categories.code='anonymous' THEN NULL ELSE users.id END AS "authorId",
      CASE WHEN categories.code='anonymous' THEN '익명' ELSE users.nickname END AS "authorName",
      CASE WHEN categories.code='anonymous' THEN NULL ELSE user_stamp_emoji(users.id) END AS "authorStampEmoji",
      (CASE WHEN categories.code='notice' THEN lower(COALESCE($3::text,''))='freesetting@naver.com' ELSE posts.author_id=$2::uuid END) AS "canEdit",
      ($2::uuid IS NOT NULL AND posts.author_id<>$2::uuid) AS "canReport",
      EXISTS(SELECT 1 FROM post_reactions WHERE post_id=posts.id AND user_id=$2::uuid AND reaction='like') AS "isLiked",
      (SELECT count(*)::int FROM post_reactions WHERE post_id=posts.id AND reaction='like') AS "likeCount",
      EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id=posts.id AND user_id=$2::uuid) AS "isBookmarked",
      posts.bookmark_count AS "bookmarkCount",
      CASE WHEN bounty.id IS NULL THEN NULL ELSE json_build_object(
        'id',bounty.id,'amount',bounty.amount,'awardAmount',bounty.award_amount,
        'feeAmount',bounty.fee_amount,'status',bounty.status,'expiresAt',bounty.expires_at,
        'acceptedCommentId',bounty.accepted_comment_id,'recipientName',CASE WHEN categories.code='anonymous' THEN '익명 답변자' ELSE bounty_recipient.nickname END,
        'canAward',(posts.author_id=$2::uuid AND bounty.status='open' AND bounty.expires_at>now()),
        'canRefund',(posts.author_id=$2::uuid AND bounty.status='open' AND bounty.expires_at<=now())
      ) END AS bounty
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     LEFT JOIN post_acorn_bounties bounty ON bounty.post_id=posts.id
     LEFT JOIN users bounty_recipient ON bounty_recipient.id=bounty.recipient_id
     WHERE posts.id=$1 AND posts.status='published'`, [postId, user?.id || null,user?.email || null]);
  if (!detail.rows[0]) return errorResponse("글을 찾을 수 없습니다.", 404);
  const imageResult = await query<PostImageRow>(
    `SELECT id,object_key AS "objectKey",original_name AS "originalName",mime_type AS "mimeType",
      byte_size::text AS "byteSize",sort_order AS "sortOrder"
     FROM post_images WHERE post_id=$1 AND status='attached' ORDER BY sort_order,created_at`,
    [postId],
  );
  try {
    const images = await Promise.all(imageResult.rows.map(async (image) => ({
      id: image.id,
      url: await getPostImageUrl(image.objectKey),
      originalName: image.originalName,
      mimeType: image.mimeType,
      byteSize: Number(image.byteSize),
    })));
    const post = detail.rows[0] as Record<string, unknown> & { content: string; attributes?: { contentHtml?: string } };
    const renderedContentHtml = renderPostContentHtml(post.attributes?.contentHtml, post.content, images);
    const response = jsonResponse({ post: { ...post, images, renderedContentHtml } });
    if (shouldSetVisitorCookie) {
      const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
      response.headers.append("Set-Cookie", `modudadam_visitor=${visitorId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
    }
    return response;
  } catch (error) {
    console.error("[posts] failed to create image URL", error);
    return errorResponse("첨부 이미지를 불러오지 못했습니다.", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user = await requireSessionUser(request); const { postId } = await params; const body = await request.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const imageIds = normalizeImageIds(body.imageIds);
    if (!title) return errorResponse("제목을 입력해 주세요.");
    if (!imageIds || imageIds.length > MAX_POST_IMAGES) return errorResponse(`이미지는 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);
    if (!content && imageIds.length === 0) return errorResponse("내용을 입력하거나 이미지를 한 장 이상 넣어 주세요.");
    if (title.length > 80) return errorResponse("제목은 80자까지 입력할 수 있습니다.");
    if (content.length > 20000) return errorResponse("내용은 20,000자까지 입력할 수 있습니다.");
    const contentHtml = normalizePostContentHtml(body.contentHtml, content, imageIds);

    const client = await db.connect();
    const removedKeys: string[] = [];
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string }>(
        `UPDATE posts SET title=$3,content=$4,attributes=COALESCE($5::jsonb,posts.attributes),updated_at=now()
         FROM categories
         WHERE posts.id=$1 AND posts.category_id=categories.id AND posts.status='published'
           AND (CASE WHEN categories.code='notice' THEN lower(COALESCE($6::text,''))='freesetting@naver.com' ELSE posts.author_id=$2 END)
         RETURNING posts.id`,
        [postId,user.id,title,content,JSON.stringify({ contentHtml }),user.email]);
      if (!result.rows[0]) throw new Error("POST_NOT_FOUND");

      const current = await client.query<{ id: string; objectKey: string }>(
        `SELECT id,object_key AS "objectKey" FROM post_images
         WHERE post_id=$1 AND owner_id=$2 AND status='attached' FOR UPDATE`,
        [postId, user.id],
      );
      for (const [sortOrder, imageId] of imageIds.entries()) {
        const attached = await client.query(
          `UPDATE post_images SET post_id=$1,status='attached',sort_order=$2,attached_at=COALESCE(attached_at,now()),deleted_at=NULL
           WHERE id=$3 AND owner_id=$4
             AND ((post_id=$1 AND status='attached') OR (post_id IS NULL AND status='ready'))
           RETURNING id`,
          [postId, sortOrder, imageId, user.id],
        );
        if (!attached.rows[0]) throw new Error("INVALID_IMAGE");
      }
      for (const image of current.rows.filter((image) => !imageIds.includes(image.id))) {
        await client.query(
          "UPDATE post_images SET post_id=NULL,status='deleted',deleted_at=now() WHERE id=$1",
          [image.id],
        );
        removedKeys.push(image.objectKey);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await Promise.allSettled(removedKeys.map(deletePostImage));
    return jsonResponse({ id: postId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    if (error instanceof Error && error.message === "POST_NOT_FOUND") return errorResponse("수정 권한이 없거나 글이 없습니다.",404);
    if (error instanceof Error && error.message === "INVALID_IMAGE") return errorResponse("첨부 이미지가 유효하지 않거나 업로드가 완료되지 않았습니다.");
    if (error instanceof Error && error.message === "CONTENT_IMAGE_MISMATCH") return errorResponse("본문 이미지 정보가 올바르지 않습니다.");
    if (error instanceof Error && error.message === "CONTENT_HTML_TOO_LONG") return errorResponse("본문 형식 데이터가 너무 큽니다.");
    console.error("[posts] failed to update post", error);
    return errorResponse("수정하지 못했습니다.",500);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user=await requireSessionUser(request); const { postId }=await params;
    const client = await db.connect();
    let objectKeys:string[]=[];
    try {
      await client.query("BEGIN");
      const result=await client.query<{id:string}>(`UPDATE posts SET status='deleted',deleted_at=now(),updated_at=now()
        FROM categories WHERE posts.id=$1 AND posts.category_id=categories.id AND posts.status='published'
          AND (CASE WHEN categories.code='notice' THEN lower(COALESCE($3::text,''))='freesetting@naver.com' ELSE posts.author_id=$2 END)
        RETURNING posts.id`,[postId,user.id,user.email]);
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return errorResponse("삭제 권한이 없거나 글이 없습니다.",404);
      }
      const openBounty=await client.query<{ id:string;amount:number;awardAmount:number;feeAmount:number }>(
        `SELECT id,amount,award_amount AS "awardAmount",fee_amount AS "feeAmount"
         FROM post_acorn_bounties WHERE post_id=$1 AND sponsor_id=$2 AND status='open' FOR UPDATE`,[postId,user.id],
      );
      if (openBounty.rows[0]) {
        const eligible=await client.query<{ count:number }>(
          `SELECT count(*)::int AS count FROM comments WHERE post_id=$1 AND parent_id IS NULL AND status='published' AND author_id<>$2`,[postId,user.id],
        );
        const hasAnswers=(eligible.rows[0]?.count || 0)>0;
        const refundAmount=hasAnswers ? openBounty.rows[0].awardAmount : openBounty.rows[0].amount;
        await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
        const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[user.id]);
        if ((wallet.rows[0]?.balance || 0)+refundAmount>20000) {
          await client.query("ROLLBACK");
          return errorResponse("현상금 환불을 받을 도토리 보관 공간을 먼저 비워 주세요.",409);
        }
        await client.query(`UPDATE acorn_wallets SET balance=balance+$2,updated_at=now() WHERE user_id=$1`,[user.id,refundAmount]);
        await client.query(
          `INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description)
           VALUES($1,$2,'bounty_refund',$3,'게시글 삭제에 따른 답변 현상금 환불')`,[user.id,refundAmount,openBounty.rows[0].id],
        );
        if (hasAnswers && openBounty.rows[0].feeAmount>0) await client.query(
          `INSERT INTO acorn_bounty_burns(bounty_id,amount,reason) VALUES($1,$2,'expired_with_answers')`,[openBounty.rows[0].id,openBounty.rows[0].feeAmount],
        );
        await client.query(`UPDATE post_acorn_bounties SET status='refunded',refunded_at=now(),updated_at=now() WHERE id=$1`,[openBounty.rows[0].id]);
      }
      const images=await client.query<{ objectKey:string }>(
        `UPDATE post_images SET post_id=NULL,status='deleted',deleted_at=now()
         WHERE post_id=$1 AND status='attached' RETURNING object_key AS "objectKey"`,
        [postId],
      );
      objectKeys=images.rows.map((image) => image.objectKey);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await Promise.allSettled(objectKeys.map(deletePostImage));
    return jsonResponse({id:postId});
  } catch(error){return error instanceof Error&&error.message==="UNAUTHORIZED"?errorResponse("로그인이 필요합니다.",401):errorResponse("삭제하지 못했습니다.",500);}
}
export function OPTIONS(){return corsPreflightResponse();}

function normalizeImageIds(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) return null;
  return [...new Set(value)];
}
