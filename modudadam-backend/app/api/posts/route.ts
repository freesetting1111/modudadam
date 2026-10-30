import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const search = request.nextUrl.searchParams.get("q")?.trim();
  const sort = request.nextUrl.searchParams.get("sort");
  const result = await query(
    `SELECT posts.id, posts.title, posts.summary, posts.post_type AS "postType",
      posts.view_count AS "viewCount", posts.comment_count AS "commentCount",
      posts.is_notice AS "isNotice",posts.is_pinned AS "isPinned",
      posts.published_at AS "publishedAt",posts.created_at AS "createdAt",categories.code AS "categoryCode",
      categories.name AS "categoryName",COALESCE(local_account.login_id,users.nickname) AS "authorName"
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     LEFT JOIN user_local_accounts local_account ON local_account.user_id=users.id
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
    if (!body.categoryCode || !body.title?.trim() || !body.content?.trim()) return errorResponse("카테고리, 제목, 내용을 입력해 주세요.");
    const result = await query<{ id: string }>(
      `INSERT INTO posts(category_id,author_id,title,summary,content,post_type,attributes,published_at)
       SELECT id,$1,$2,$3,$4,$5,$6::jsonb,now() FROM categories WHERE code=$7
       RETURNING id`,
      [user.id, body.title.trim(), body.summary?.trim() || null, body.content.trim(), body.postType || "community", JSON.stringify(body.attributes || {}), body.categoryCode],
    );
    if (!result.rows[0]) return errorResponse("존재하지 않는 카테고리입니다.");
    return jsonResponse({ id: result.rows[0].id }, { status: 201 });
  } catch (error) {
    return error instanceof Error && error.message === "UNAUTHORIZED" ? errorResponse("로그인이 필요합니다.", 401) : errorResponse("글을 저장하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
