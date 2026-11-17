import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

type ActivityType = "posts" | "comments" | "scraps";
type ActivityCounts = { posts: number; comments: number; scraps: number };

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const category = request.nextUrl.searchParams.get("category")?.trim() || "pets";
    const requestedType = request.nextUrl.searchParams.get("type");
    const type: ActivityType = requestedType === "comments" || requestedType === "scraps" ? requestedType : "posts";
    const pageSize = 10;
    const requestedPage = normalizePage(request.nextUrl.searchParams.get("page"));

    const categoryResult = await query(`SELECT code FROM categories WHERE code=$1 AND is_active=TRUE LIMIT 1`, [category]);
    if (categoryResult.rowCount === 0) return errorResponse("존재하지 않는 게시판입니다.", 400);

    const countResult = await query<ActivityCounts>(
      `SELECT
        (SELECT COUNT(*)::int FROM posts
         JOIN categories ON categories.id=posts.category_id
         WHERE posts.author_id=$1 AND posts.status='published' AND categories.code=$2) AS posts,
        (SELECT COUNT(*)::int FROM comments
         JOIN posts ON posts.id=comments.post_id JOIN categories ON categories.id=posts.category_id
         WHERE comments.author_id=$1 AND comments.status='published' AND posts.status='published' AND categories.code=$2) AS comments,
        (SELECT COUNT(*)::int FROM post_bookmarks bookmarks
         JOIN posts ON posts.id=bookmarks.post_id JOIN categories ON categories.id=posts.category_id
         WHERE bookmarks.user_id=$1 AND posts.status='published' AND categories.code=$2) AS scraps`,
      [user.id, category],
    );
    const counts = countResult.rows[0] || { posts: 0, comments: 0, scraps: 0 };
    const totalItems = counts[type];
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const posts = type === "posts" ? await query(
      `SELECT posts.id,posts.title,posts.created_at AS "createdAt",posts.view_count AS "viewCount",
        posts.comment_count AS "commentCount",categories.name AS "categoryName",categories.code AS "categoryCode"
       FROM posts JOIN categories ON categories.id=posts.category_id
       WHERE posts.author_id=$1 AND posts.status='published' AND categories.code=$2
       ORDER BY posts.created_at DESC,posts.id DESC LIMIT $3 OFFSET $4`,
      [user.id, category, pageSize, offset],
    ) : null;
    const comments = type === "comments" ? await query(
      `SELECT comments.id,comments.post_id AS "postId",comments.content,comments.created_at AS "createdAt",
        posts.title AS "postTitle",categories.name AS "categoryName",categories.code AS "categoryCode"
       FROM comments JOIN posts ON posts.id=comments.post_id JOIN categories ON categories.id=posts.category_id
       WHERE comments.author_id=$1 AND comments.status='published' AND posts.status='published' AND categories.code=$2
       ORDER BY comments.created_at DESC,comments.id DESC LIMIT $3 OFFSET $4`,
      [user.id, category, pageSize, offset],
    ) : null;
    const scraps = type === "scraps" ? await query(
      `SELECT posts.id,posts.title,bookmarks.created_at AS "createdAt",posts.view_count AS "viewCount",
        posts.comment_count AS "commentCount",categories.name AS "categoryName",categories.code AS "categoryCode",users.nickname AS "authorName"
       FROM post_bookmarks bookmarks JOIN posts ON posts.id=bookmarks.post_id
       JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
       WHERE bookmarks.user_id=$1 AND posts.status='published' AND categories.code=$2
       ORDER BY bookmarks.created_at DESC,posts.id DESC LIMIT $3 OFFSET $4`,
      [user.id, category, pageSize, offset],
    ) : null;

    return jsonResponse({
      posts: posts?.rows || [], comments: comments?.rows || [], scraps: scraps?.rows || [], counts,
      pagination: { page, pageSize, totalItems, totalPages },
    });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("내 활동을 불러오지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }

function normalizePage(value: string | null) {
  const parsed = Number(value || 1);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}
