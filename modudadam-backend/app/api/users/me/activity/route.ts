import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const [posts, comments, scraps] = await Promise.all([
      query(
        `SELECT posts.id,posts.title,posts.created_at AS "createdAt",posts.view_count AS "viewCount",
          posts.comment_count AS "commentCount",categories.name AS "categoryName"
         FROM posts JOIN categories ON categories.id=posts.category_id
         WHERE posts.author_id=$1 AND posts.status='published'
         ORDER BY posts.created_at DESC LIMIT 100`, [user.id],
      ),
      query(
        `SELECT comments.id,comments.post_id AS "postId",comments.content,comments.created_at AS "createdAt",
          posts.title AS "postTitle",categories.name AS "categoryName"
         FROM comments JOIN posts ON posts.id=comments.post_id JOIN categories ON categories.id=posts.category_id
         WHERE comments.author_id=$1 AND comments.status='published' AND posts.status='published'
         ORDER BY comments.created_at DESC LIMIT 100`, [user.id],
      ),
      query(
        `SELECT posts.id,posts.title,bookmarks.created_at AS "createdAt",posts.view_count AS "viewCount",
          posts.comment_count AS "commentCount",categories.name AS "categoryName",users.nickname AS "authorName"
         FROM post_bookmarks bookmarks JOIN posts ON posts.id=bookmarks.post_id
         JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
         WHERE bookmarks.user_id=$1 AND posts.status='published'
         ORDER BY bookmarks.created_at DESC LIMIT 100`, [user.id],
      ),
    ]);
    return jsonResponse({ posts: posts.rows, comments: comments.rows, scraps: scraps.rows });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED"
      ? errorResponse("로그인이 필요합니다.", 401)
      : errorResponse("내 활동을 불러오지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
