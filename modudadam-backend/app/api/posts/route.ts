import type { NextRequest } from "next/server";
import { db, query } from "@/lib/db";
import { requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { MAX_POST_IMAGES } from "@/lib/s3";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const search = request.nextUrl.searchParams.get("q")?.trim();
  const sort = request.nextUrl.searchParams.get("sort");
  const result = await query(
    `SELECT posts.id, posts.title, posts.post_type AS "postType",
      posts.view_count AS "viewCount", posts.comment_count AS "commentCount",
      posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",
      posts.published_at AS "publishedAt",posts.created_at AS "createdAt",categories.code AS "categoryCode",
      categories.name AS "categoryName",users.nickname AS "authorName"
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     WHERE posts.status='published' AND ($1::text IS NULL OR categories.code=$1)
       AND ($2::text IS NULL OR posts.title ILIKE '%'||$2||'%' OR posts.content ILIKE '%'||$2||'%')
     ORDER BY posts.is_pinned DESC,
       CASE WHEN $3='popular' THEN posts.view_count+posts.comment_count*3 END DESC,
       posts.published_at DESC NULLS LAST, posts.created_at DESC LIMIT 50`,
    [category, search || null, sort || "latest"],
  );
  return jsonResponse({ posts: result.rows });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const imageIds = normalizeImageIds(body.imageIds);
    if (!body.categoryCode || !title || !content) return errorResponse("카테고리, 제목, 내용을 입력해 주세요.");
    if (title.length > 200 || content.length > 10000) return errorResponse("입력 가능한 글자 수를 확인해 주세요.");
    if (!imageIds || imageIds.length > MAX_POST_IMAGES) return errorResponse(`이미지는 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string }>(
        `INSERT INTO posts(category_id,author_id,title,content,post_type,attributes,published_at)
         SELECT id,$1,$2,$3,$4,$5::jsonb,now() FROM categories WHERE code=$6
         RETURNING id`,
        [user.id, title, content, body.postType || "community", JSON.stringify(body.attributes || {}), body.categoryCode],
      );
      const post = result.rows[0];
      if (!post) throw new Error("CATEGORY_NOT_FOUND");

      for (const [sortOrder, imageId] of imageIds.entries()) {
        const attached = await client.query(
          `UPDATE post_images SET post_id=$1,status='attached',sort_order=$2,attached_at=now()
           WHERE id=$3 AND owner_id=$4 AND post_id IS NULL AND status='ready' RETURNING id`,
          [post.id, sortOrder, imageId, user.id],
        );
        if (!attached.rows[0]) throw new Error("INVALID_IMAGE");
      }
      await client.query("COMMIT");
      return jsonResponse({ id: post.id }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") return errorResponse("존재하지 않는 카테고리입니다.");
    if (error instanceof Error && error.message === "INVALID_IMAGE") return errorResponse("첨부 이미지가 유효하지 않거나 업로드가 완료되지 않았습니다.");
    console.error("[posts] failed to create post", error);
    return errorResponse("글을 저장하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }

function normalizeImageIds(value: unknown) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) return null;
  return [...new Set(value)];
}
