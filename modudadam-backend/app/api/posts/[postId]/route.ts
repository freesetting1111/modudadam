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
      users.id AS "authorId",users.nickname AS "authorName",
      (posts.author_id=$2::uuid) AS "canEdit",
      ($2::uuid IS NOT NULL AND posts.author_id<>$2::uuid) AS "canReport",
      EXISTS(SELECT 1 FROM post_bookmarks WHERE post_id=posts.id AND user_id=$2::uuid) AS "isBookmarked",
      (SELECT count(*)::int FROM post_bookmarks WHERE post_id=posts.id) AS "bookmarkCount"
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     WHERE posts.id=$1 AND posts.status='published'`, [postId, user?.id || null]);
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
    if (!title || !content) return errorResponse("제목과 내용을 입력해 주세요.");
    if (title.length > 200 || content.length > 20000) return errorResponse("입력 가능한 글자 수를 확인해 주세요.");
    if (!imageIds || imageIds.length > MAX_POST_IMAGES) return errorResponse(`이미지는 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);
    const contentHtml = normalizePostContentHtml(body.contentHtml, content, imageIds);

    const client = await db.connect();
    const removedKeys: string[] = [];
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string }>(
        `UPDATE posts SET title=$3,content=$4,attributes=COALESCE($5::jsonb,attributes),updated_at=now()
         WHERE id=$1 AND author_id=$2 AND status='published' RETURNING id`,
        [postId,user.id,title,content,JSON.stringify({ contentHtml })]);
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
    let objectKeys: string[] = [];
    try {
      await client.query("BEGIN");
      const result=await client.query<{id:string}>("UPDATE posts SET status='deleted',deleted_at=now(),updated_at=now() WHERE id=$1 AND author_id=$2 RETURNING id",[postId,user.id]);
      if (!result.rows[0]) {
        await client.query("ROLLBACK");
        return errorResponse("삭제 권한이 없거나 글이 없습니다.",404);
      }
      const images = await client.query<{ objectKey: string }>(
        `UPDATE post_images SET post_id=NULL,status='deleted',deleted_at=now()
         WHERE post_id=$1 AND owner_id=$2 AND status='attached' RETURNING object_key AS "objectKey"`,
        [postId, user.id],
      );
      objectKeys = images.rows.map((image) => image.objectKey);
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
