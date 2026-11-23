import type { NextRequest } from "next/server";
import { db, query } from "@/lib/db";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { MAX_POST_IMAGES } from "@/lib/s3";
import { normalizePostContentHtml } from "@/domains/community/post-content";
import { normalizeBountyAmount } from "@/lib/acorn-economy";

export async function GET(request: NextRequest) {
  const viewerKey = await getViewerKey(request);
  const category = request.nextUrl.searchParams.get("category");
  const search = request.nextUrl.searchParams.get("q")?.trim();
  const requestedSort = request.nextUrl.searchParams.get("sort");
  const sort: "latest" | "popular" | "weekly" | "bounty" = requestedSort === "popular" || requestedSort === "weekly" || requestedSort === "bounty" ? requestedSort : "latest";
  const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));
  const bountyOnly=request.nextUrl.searchParams.get("bountyOnly")==="true";
  const bountyFilter=bountyOnly ? ` AND EXISTS(
    SELECT 1 FROM post_acorn_bounties active_bounty
    WHERE active_bounty.post_id=posts.id AND active_bounty.status='open' AND active_bounty.expires_at>now()
  )` : "";
  const pageMode = request.nextUrl.searchParams.has("page") || request.nextUrl.searchParams.has("currentPostId") || sort==="bounty";

  const select = `SELECT posts.id, posts.title, posts.post_type AS "postType",
      posts.view_count AS "viewCount", posts.comment_count AS "commentCount",
      posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",
      posts.published_at AS "publishedAt",posts.created_at AS "createdAt",categories.code AS "categoryCode",
      categories.name AS "categoryName",
      CASE WHEN categories.code='anonymous' THEN '익명' ELSE users.nickname END AS "authorName",
      CASE WHEN categories.code='anonymous' THEN NULL ELSE user_stamp_emoji(users.id) END AS "authorStampEmoji",
      COALESCE((SELECT amount FROM post_acorn_bounties bounty WHERE bounty.post_id=posts.id AND bounty.status='open' AND bounty.expires_at>now()),0) AS "bountyAmount",
      left(regexp_replace(posts.content, E'[\\n\\r]+', ' ', 'g'), 140) AS excerpt,
      (posts.view_count + posts.comment_count * 3) AS "popularityScore"
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     WHERE posts.status='published' AND ($1::text IS NULL OR categories.code=$1)
       AND ($2::text IS NULL OR (posts.title || ' ' || posts.content) ILIKE '%'||$2||'%')${bountyFilter}`;

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
           categories.name AS "categoryName",
           CASE WHEN categories.code='anonymous' THEN '익명' ELSE users.nickname END AS "authorName",
           CASE WHEN categories.code='anonymous' THEN NULL ELSE user_stamp_emoji(users.id) END AS "authorStampEmoji",
           COALESCE((SELECT amount FROM post_acorn_bounties bounty WHERE bounty.post_id=posts.id AND bounty.status='open' AND bounty.expires_at>now()),0) AS "bountyAmount",
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
         "categoryCode","categoryName","authorName","authorStampEmoji","bountyAmount","weeklyViews","weeklyComments","weeklyLikes","weeklyScore"
       FROM ranked WHERE category_rank <= $1 ORDER BY "categoryCode",category_rank`,
      [perCategory],
    );
    return jsonResponse({ posts: await attachReadState(weekly.rows,viewerKey) });
  }

  if (request.nextUrl.searchParams.get("groupedByCategory") === "true") {
    const perCategory = Math.min(10, Math.max(1, Number(request.nextUrl.searchParams.get("perCategory")) || 10));
    const grouped = await query(
      `WITH ranked AS (
         SELECT posts.id,posts.title,posts.view_count AS "viewCount",posts.comment_count AS "commentCount",
           posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",posts.created_at AS "createdAt",
           categories.code AS "categoryCode",categories.name AS "categoryName",
           CASE WHEN categories.code='anonymous' THEN '익명' ELSE users.nickname END AS "authorName",
           CASE WHEN categories.code='anonymous' THEN NULL ELSE user_stamp_emoji(users.id) END AS "authorStampEmoji",
           COALESCE((SELECT amount FROM post_acorn_bounties bounty WHERE bounty.post_id=posts.id AND bounty.status='open' AND bounty.expires_at>now()),0) AS "bountyAmount",
           ROW_NUMBER() OVER(PARTITION BY posts.category_id ORDER BY posts.is_pinned DESC,posts.published_at DESC,posts.id DESC) AS category_rank
         FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
         WHERE posts.status='published'
       )
       SELECT id,title,"viewCount","commentCount","isNotice","isPinned","createdAt","categoryCode","categoryName","authorName","authorStampEmoji","bountyAmount"
       FROM ranked WHERE category_rank <= $1 ORDER BY "categoryCode",category_rank`,
      [perCategory],
    );
    return jsonResponse({ posts: await attachReadState(grouped.rows,viewerKey) });
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
         categories.code AS "categoryCode",categories.name AS "categoryName",
         CASE WHEN categories.code='anonymous' THEN '익명' ELSE users.nickname END AS "authorName",
         CASE WHEN categories.code='anonymous' THEN NULL ELSE user_stamp_emoji(users.id) END AS "authorStampEmoji",
         COALESCE((SELECT amount FROM post_acorn_bounties bounty WHERE bounty.post_id=posts.id AND bounty.status='open' AND bounty.expires_at>now()),0) AS "bountyAmount",
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
    return jsonResponse({ posts: await attachReadState(weekly.rows,viewerKey), nextCursor: null, hasMore: false });
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
         AND ($2::text IS NULL OR (posts.title || ' ' || posts.content) ILIKE '%'||$2||'%')${bountyFilter}`,
      [category, search || null],
    );
    const totalItems = totalResult.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    let page = Math.min(requestedPage, totalPages);
    if (!request.nextUrl.searchParams.has("page") && currentPostId) {
      const orderBy = sort === "bounty"
        ? `(SELECT amount FROM post_acorn_bounties priority_bounty WHERE priority_bounty.post_id=posts.id AND priority_bounty.status='open' AND priority_bounty.expires_at>now()) DESC,posts.published_at DESC,posts.id DESC`
        : sort === "popular"
          ? `posts.is_pinned DESC,(posts.view_count + posts.comment_count * 3) DESC,posts.published_at DESC,posts.id DESC`
          : `posts.is_pinned DESC,posts.published_at DESC,posts.id DESC`;
      const position = await query<{ position: string }>(
        `SELECT position::text FROM (
           SELECT posts.id,ROW_NUMBER() OVER(ORDER BY ${orderBy}) AS position
           FROM posts JOIN categories ON categories.id=posts.category_id
           WHERE posts.status='published' AND ($1::text IS NULL OR categories.code=$1)
             AND ($2::text IS NULL OR (posts.title || ' ' || posts.content) ILIKE '%'||$2||'%')${bountyFilter}
         ) ranked WHERE id=$3`,
        [category, search || null, currentPostId],
      );
      if (position.rows[0]) page = Math.ceil(Number(position.rows[0].position) / limit);
    }
    const orderBy = sort === "bounty"
      ? `(SELECT amount FROM post_acorn_bounties priority_bounty WHERE priority_bounty.post_id=posts.id AND priority_bounty.status='open' AND priority_bounty.expires_at>now()) DESC,posts.published_at DESC,posts.id DESC`
      : sort === "popular"
        ? `posts.is_pinned DESC,(posts.view_count + posts.comment_count * 3) DESC,posts.published_at DESC,posts.id DESC`
        : `posts.is_pinned DESC,posts.published_at DESC,posts.id DESC`;
    const result = await query(`${select} ORDER BY ${orderBy} LIMIT $3 OFFSET $4`, [category, search || null, limit, (page - 1) * limit]);
    return jsonResponse({ posts: await attachReadState(result.rows,viewerKey), pagination: { page, pageSize: limit, totalItems, totalPages } });
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
  return jsonResponse({ posts: await attachReadState(posts,viewerKey), nextCursor, hasMore });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const categoryCode=String(body.categoryCode || "").trim();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const bountyAmount=normalizeBountyAmount(body.bountyAmount);
    const postType=String(body.postType || "community")==="bounty_question" ? "bounty_question" : "community";
    const isBountyQuestion=postType==="bounty_question";
    const imageIds = normalizeImageIds(body.imageIds);
    if (!categoryCode || !title) return errorResponse("카테고리와 제목을 입력해 주세요.");
    if (bountyAmount===null) return errorResponse("답변 현상금은 100, 200, 300개 중에서 선택해 주세요.");
    if (isBountyQuestion && (categoryCode!=="bounty" || !bountyAmount)) return errorResponse("현상금 질문은 100, 200, 300개 중 하나를 반드시 선택해 주세요.");
    if (!isBountyQuestion && bountyAmount!==0) return errorResponse("현상금은 현상금 질문 서비스에서만 등록할 수 있습니다.");
    if (!isBountyQuestion && categoryCode==="bounty") return errorResponse("현상금 질문은 전용 작성 화면에서 등록해 주세요.");
    if (categoryCode==="notice" && user.email?.trim().toLowerCase()!=="freesetting@naver.com") return errorResponse("공지사항은 운영자만 작성할 수 있습니다.",403);
    if (!imageIds || imageIds.length > MAX_POST_IMAGES) return errorResponse(`이미지는 최대 ${MAX_POST_IMAGES}장까지 첨부할 수 있습니다.`);
    if (!content && imageIds.length === 0) return errorResponse("내용을 입력하거나 이미지를 한 장 이상 넣어 주세요.");
    if (title.length > 80) return errorResponse("제목은 80자까지 입력할 수 있습니다.");
    if (content.length > 20000) return errorResponse("내용은 20,000자까지 입력할 수 있습니다.");
    const contentHtml = normalizePostContentHtml(body.contentHtml, content, imageIds);

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string }>(
        `INSERT INTO posts(category_id,author_id,title,content,post_type,attributes,is_notice,published_at)
         SELECT id,$1,$2,$3,$4,$5::jsonb,(code='notice'),now() FROM categories WHERE code=$6 AND is_active
         RETURNING id`,
        [user.id, title, content, postType, JSON.stringify({ contentHtml }), categoryCode],
      );
      const post = result.rows[0];
      if (!post) throw new Error("CATEGORY_NOT_FOUND");

      let walletBalance:number | null=null;
      if (bountyAmount>0) {
        await client.query(`INSERT INTO acorn_wallets(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`,[user.id]);
        const wallet=await client.query<{ balance:number }>(`SELECT balance FROM acorn_wallets WHERE user_id=$1 FOR UPDATE`,[user.id]);
        if ((wallet.rows[0]?.balance || 0)<bountyAmount) throw new Error("INSUFFICIENT_ACORNS");
        const feeAmount=Math.floor(bountyAmount*.1);
        const awardAmount=bountyAmount-feeAmount;
        await client.query(`UPDATE acorn_wallets SET balance=balance-$2,lifetime_spent=lifetime_spent+$2,updated_at=now() WHERE user_id=$1`,[user.id,bountyAmount]);
        const bounty=await client.query<{ id:string }>(
          `INSERT INTO post_acorn_bounties(post_id,sponsor_id,amount,fee_amount,award_amount)
           VALUES($1,$2,$3::integer,$4::integer,$5::integer) RETURNING id`,[post.id,user.id,bountyAmount,feeAmount,awardAmount],
        );
        await client.query(
          `INSERT INTO acorn_transactions(user_id,amount,transaction_type,reference_id,description)
           VALUES($1,$2::integer,'bounty_escrow',$3,$4)`,
          [user.id,-bountyAmount,bounty.rows[0].id,`게시글 답변 현상금 ${bountyAmount.toLocaleString()}개 예치`],
        );
        walletBalance=(wallet.rows[0]?.balance || 0)-bountyAmount;
      }

      for (const [sortOrder, imageId] of imageIds.entries()) {
        const attached = await client.query(
          `UPDATE post_images SET post_id=$1,status='attached',sort_order=$2,attached_at=now()
           WHERE id=$3 AND owner_id=$4 AND post_id IS NULL AND status='ready' RETURNING id`,
          [post.id, sortOrder, imageId, user.id],
        );
        if (!attached.rows[0]) throw new Error("INVALID_IMAGE");
      }
      await client.query("COMMIT");
      return jsonResponse({ id: post.id,bountyAmount,walletBalance }, { status: 201 });
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
    if (error instanceof Error && error.message === "INSUFFICIENT_ACORNS") return errorResponse("현상금으로 예치할 도토리가 부족합니다.",409);
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

function decodeCursor(value: string | null, sort: "latest" | "popular" | "weekly" | "bounty"): PostCursor | null {
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

async function getViewerKey(request:NextRequest) {
  const user=await getSessionUser(request);
  if (user) return `user:${user.id}`;
  const visitorId=request.cookies.get("modudadam_visitor")?.value || "";
  return /^[0-9a-f-]{36}$/i.test(visitorId) ? `visitor:${visitorId}` : null;
}

async function attachReadState<T extends Record<string,unknown>>(rows:T[],viewerKey:string|null) {
  if (!rows.length) return rows;
  if (!viewerKey) return rows.map((row) => ({ ...row,isRead:false }));
  const ids=rows.map((row) => String(row.id)).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const viewed=await query<{ postId:string }>(`SELECT post_id::text AS "postId" FROM post_views WHERE viewer_key=$1 AND post_id=ANY($2::uuid[])`,[viewerKey,ids]);
  const readIds=new Set(viewed.rows.map((row) => row.postId));
  return rows.map((row) => ({ ...row,isRead:readIds.has(String(row.id)) }));
}
