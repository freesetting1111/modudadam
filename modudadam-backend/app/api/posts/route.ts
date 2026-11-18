import type { NextRequest } from "next/server";
import { db, query } from "@/lib/db";
import { requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { MAX_POST_IMAGES } from "@/lib/s3";
import { normalizePostContentHtml } from "@/domains/community/post-content";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const search = request.nextUrl.searchParams.get("q")?.trim();
  const requestedSort = request.nextUrl.searchParams.get("sort");
  const sort: "latest" | "popular" | "weekly" = requestedSort === "popular" || requestedSort === "weekly" ? requestedSort : "latest";
  const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));
  const pageMode = request.nextUrl.searchParams.has("page") || request.nextUrl.searchParams.has("currentPostId");

  const select = `SELECT posts.id, posts.title, posts.post_type AS "postType",
      posts.view_count AS "viewCount", posts.comment_count AS "commentCount",
      posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",
      posts.published_at AS "publishedAt",posts.created_at AS "createdAt",categories.code AS "categoryCode",
      categories.name AS "categoryName",users.nickname AS "authorName",
      left(regexp_replace(posts.content, E'[\\n\\r]+', ' ', 'g'), 140) AS excerpt,
      (posts.view_count + posts.comment_count * 3) AS "popularityScore"
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     WHERE posts.status='published' AND ($1::text IS NULL OR categories.code=$1)
       AND ($2::text IS NULL OR (posts.title || ' ' || posts.content) ILIKE '%'||$2||'%')`;

  if (request.nextUrl.searchParams.get("weeklyByCategory") === "true") {
    const perCategory = Math.min(5, Math.max(1, Number(request.nextUrl.searchParams.get("perCategory")) || 5));
    const weekly = await query(
      `WITH weekly_views AS (
         SELECT post_id,COUNT(*)::int AS views FROM post_views
         WHERE first_viewed_at >= NOW() - INTERVAL '7 days' GROUP BY post_id
       ), weekly_comments AS (
         SELECT post_id,COUNT(*)::int AS comments FROM comments
         WHERE status='published' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY post_id
       ), weekly_likes AS (
         SELECT post_id,COUNT(*)::int AS likes FROM post_reactions
         WHERE reaction='like' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY post_id
       ), scored AS (
         SELECT posts.id,posts.title,posts.view_count AS "viewCount",posts.comment_count AS "commentCount",
           posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",posts.created_at AS "createdAt",
           posts.published_at,categories.id AS category_id,categories.code AS "categoryCode",
           categories.name AS "categoryName",users.nickname AS "authorName",
           COALESCE(weekly_views.views,0) AS "weeklyViews",
           COALESCE(weekly_comments.comments,0) AS "weeklyComments",
           COALESCE(weekly_likes.likes,0) AS "weeklyLikes",
           (COALESCE(weekly_views.views,0) + COALESCE(weekly_comments.comments,0)*3 + COALESCE(weekly_likes.likes,0)*2) AS "weeklyScore"
         FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
         LEFT JOIN weekly_views ON weekly_views.post_id=posts.id
         LEFT JOIN weekly_comments ON weekly_comments.post_id=posts.id
         LEFT JOIN weekly_likes ON weekly_likes.post_id=posts.id
         WHERE posts.status='published'
       ), ranked AS (
         SELECT scored.*,ROW_NUMBER() OVER(
           PARTITION BY category_id ORDER BY "weeklyScore" DESC,published_at DESC,id DESC
         ) AS category_rank
         FROM scored WHERE "weeklyScore" > 0
       )
       SELECT id,title,"viewCount","commentCount","isNotice","isPinned","createdAt",
         "categoryCode","categoryName","authorName","weeklyViews","weeklyComments","weeklyLikes","weeklyScore"
       FROM ranked WHERE category_rank <= $1 ORDER BY "categoryCode",category_rank`,
      [perCategory],
    );
    return jsonResponse({ posts: weekly.rows });
  }

  if (request.nextUrl.searchParams.get("groupedByCategory") === "true") {
    const perCategory = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("perCategory")) || 10));
    const grouped = await query(
      `WITH ranked AS (
         SELECT posts.id,posts.title,posts.view_count AS "viewCount",posts.comment_count AS "commentCount",
           posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",posts.created_at AS "createdAt",
           categories.code AS "categoryCode",categories.name AS "categoryName",users.nickname AS "authorName",
           ROW_NUMBER() OVER(PARTITION BY posts.category_id ORDER BY posts.is_pinned DESC,posts.published_at DESC,posts.id DESC) AS category_rank
         FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
         WHERE posts.status='published'
       )
       SELECT id,title,"viewCount","commentCount","isNotice","isPinned","createdAt","categoryCode","categoryName","authorName"
       FROM ranked WHERE category_rank <= $1 ORDER BY "categoryCode",category_rank`,
      [perCategory],
    );
    return jsonResponse({ posts: grouped.rows });
  }

  if (sort === "weekly") {
    const weekly = await query(
      `WITH weekly_views AS (
         SELECT post_id,COUNT(*)::int AS views FROM post_views
         WHERE first_viewed_at >= NOW() - INTERVAL '7 days' GROUP BY post_id
       ), weekly_comments AS (
         SELECT post_id,COUNT(*)::int AS comments FROM comments
         WHERE status='published' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY post_id
       ), weekly_likes AS (
         SELECT post_id,COUNT(*)::int AS likes FROM post_reactions
         WHERE reaction='like' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY post_id
       )
       SELECT posts.id,posts.title,posts.view_count AS "viewCount",posts.comment_count AS "commentCount",
         posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",posts.created_at AS "createdAt",
         categories.code AS "categoryCode",categories.name AS "categoryName",users.nickname AS "authorName",
         COALESCE(weekly_views.views,0) AS "weeklyViews",COALESCE(weekly_comments.comments,0) AS "weeklyComments",
         COALESCE(weekly_likes.likes,0) AS "weeklyLikes",
         (COALESCE(weekly_views.views,0) + COALESCE(weekly_comments.comments,0)*3 + COALESCE(weekly_likes.likes,0)*2) AS "weeklyScore"
       FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
       LEFT JOIN weekly_views ON weekly_views.post_id=posts.id
       LEFT JOIN weekly_comments ON weekly_comments.post_id=posts.id
       LEFT JOIN weekly_likes ON weekly_likes.post_id=posts.id
       WHERE posts.status='published'
       ORDER BY "weeklyScore" DESC,posts.published_at DESC,posts.id DESC LIMIT $1`,
      [limit],
    );
    return jsonResponse({ posts: weekly.rows, nextCursor: null, hasMore: false });
  }

  const cursor = decodeCursor(request.nextUrl.searchParams.get("cursor"), sort);
  if (request.nextUrl.searchParams.has("cursor") && !cursor) return errorResponse("페이지 위치 정보가 올바르지 않습니다.");

  if (pageMode) {
    const requestedPage = normalizePage(request.nextUrl.searchParams.get("page"));
    const currentPostId = normalizeUuid(request.nextUrl.searchParams.get("currentPostId"));
    const totalResult = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM posts
       JOIN categories ON categories.id=posts.category_id
       WHERE posts.status='published' AND ($1::text IS NULL OR categories.code=$1)
         AND ($2::text IS NULL OR (posts.title || ' ' || posts.content) ILIKE '%'||$2||'%')`,
      [category, search || null],
    );
    const totalItems = totalResult.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    let page = Math.min(requestedPage, totalPages);
    if (!request.nextUrl.searchParams.has("page") && currentPostId) {
      const orderBy = sort === "popular"
        ? `posts.is_pinned DESC,(posts.view_count + posts.comment_count * 3) DESC,posts.published_at DESC,posts.id DESC`
        : `posts.is_pinned DESC,posts.published_at DESC,posts.id DESC`;
      const position = await query<{ position: string }>(
        `SELECT position::text FROM (
           SELECT posts.id,ROW_NUMBER() OVER(ORDER BY ${orderBy}) AS position
           FROM posts JOIN categories ON categories.id=posts.category_id
           WHERE posts.status='published' AND ($1::text IS NULL OR categories.code=$1)
             AND ($2::text IS NULL OR (posts.title || ' ' || posts.content) ILIKE '%'||$2||'%')
         ) ranked WHERE id=$3`,
        [category, search || null, currentPostId],
      );
      if (position.rows[0]) page = Math.ceil(Number(position.rows[0].position) / limit);
    }
    const orderBy = sort === "popular"
      ? `posts.is_pinned DESC,(posts.view_count + posts.comment_count * 3) DESC,posts.published_at DESC,posts.id DESC`
      : `posts.is_pinned DESC,posts.published_at DESC,posts.id DESC`;
    const result = await query(`${select} ORDER BY ${orderBy} LIMIT $3 OFFSET $4`, [category, search || null, limit, (page - 1) * limit]);
    return jsonResponse({ posts: result.rows, pagination: { page, pageSize: limit, totalItems, totalPages } });
  }

  const result = sort === "popular"
    ? await query(`${select}
       AND ($3::boolean IS NULL
         OR posts.is_pinned < $3
         OR (posts.is_pinned = $3 AND (posts.view_count + posts.comment_count * 3) < $4)
         OR (posts.is_pinned = $3 AND (posts.view_count + posts.comment_count * 3) = $4 AND posts.published_at < $5)
         OR (posts.is_pinned = $3 AND (posts.view_count + posts.comment_count * 3) = $4 AND posts.published_at = $5 AND posts.id < $6))
       ORDER BY posts.is_pinned DESC,(posts.view_count + posts.comment_count * 3) DESC,posts.published_at DESC,posts.id DESC
       LIMIT $7`, [category, search || null, cursor?.isPinned ?? null, cursor?.score ?? null, cursor?.publishedAt ?? null, cursor?.id ?? null, limit + 1])
    : await query(`${select}
       AND ($3::boolean IS NULL
         OR posts.is_pinned < $3
         OR (posts.is_pinned = $3 AND posts.published_at < $4)
         OR (posts.is_pinned = $3 AND posts.published_at = $4 AND posts.id < $5))
       ORDER BY posts.is_pinned DESC,posts.published_at DESC,posts.id DESC
       LIMIT $6`, [category, search || null, cursor?.isPinned ?? null, cursor?.publishedAt ?? null, cursor?.id ?? null, limit + 1]);

  const hasMore = result.rows.length > limit;
  const posts = result.rows.slice(0, limit) as Array<Record<string, unknown>>;
  const last = posts.at(-1);
  const nextCursor = hasMore && last ? encodeCursor({
    isPinned: Boolean(last.isPinned),
    publishedAt: new Date(String(last.publishedAt)).toISOString(),
    id: String(last.id),
    ...(sort === "popular" ? { score: Number(last.popularityScore) } : {}),
  }) : null;
  return jsonResponse({ posts, nextCursor, hasMore });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const imageIds = normalizeImageIds(body.imageIds);
    if (!body.categoryCode || !title) return errorResponse("카테고리와 제목을 입력해 주세요.");
    if (!imageIds || imageIds.length > MAX_POST_IMAGES) return errorResponse(`이미지는 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);
    if (!content && imageIds.length === 0) return errorResponse("내용을 입력하거나 이미지를 한 장 이상 넣어 주세요.");
    if (title.length > 80) return errorResponse("제목은 80자까지 입력할 수 있습니다.");
    if (content.length > 20000) return errorResponse("내용은 20,000자까지 입력할 수 있습니다.");
    const contentHtml = normalizePostContentHtml(body.contentHtml, content, imageIds);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string }>(
        `INSERT INTO posts(category_id,author_id,title,content,post_type,attributes,published_at)
         SELECT id,$1,$2,$3,$4,$5::jsonb,now() FROM categories WHERE code=$6
         RETURNING id`,
        [user.id, title, content, body.postType || "community", JSON.stringify({ contentHtml }), body.categoryCode],
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
    if (error instanceof Error && error.message === "CONTENT_IMAGE_MISMATCH") return errorResponse("본문 이미지 정보가 올바르지 않습니다.");
    if (error instanceof Error && error.message === "CONTENT_HTML_TOO_LONG") return errorResponse("본문 형식 데이터가 너무 큽니다.");
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

type PostCursor = { isPinned: boolean; publishedAt: string; id: string; score?: number };

function normalizeLimit(value: string | null) {
  const parsed = Number(value || 20);
  return Number.isInteger(parsed) ? Math.min(50, Math.max(1, parsed)) : 20;
}

function normalizePage(value: string | null) {
  const parsed = Number(value || 1);
  return Number.isInteger(parsed) ? Math.max(1, parsed) : 1;
}

function normalizeUuid(value: string | null) {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function encodeCursor(cursor: PostCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string | null, sort: "latest" | "popular"): PostCursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PostCursor>;
    if (typeof cursor.isPinned !== "boolean"
      || typeof cursor.publishedAt !== "string" || !Number.isFinite(Date.parse(cursor.publishedAt))
      || typeof cursor.id !== "string" || !/^[0-9a-f-]{36}$/i.test(cursor.id)
      || (sort === "popular" && (typeof cursor.score !== "number" || !Number.isFinite(cursor.score)))) return null;
    return cursor as PostCursor;
  } catch {
    return null;
  }
}
