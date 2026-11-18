import type { NextRequest } from "next/server";
import { corsPreflightResponse, jsonResponse } from "@/lib/http";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");
  const result = await query(
    `SELECT posts.id,posts.title,left(regexp_replace(posts.content,E'[\\n\\r]+',' ','g'),220) AS excerpt,
       posts.view_count AS "viewCount",posts.comment_count AS "commentCount",posts.created_at AS "createdAt",
       categories.code AS "categoryCode",categories.name AS "categoryName",users.nickname AS "authorName",user_stamp_emoji(users.id) AS "authorStampEmoji"
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     WHERE posts.status='published' AND posts.is_notice=false
       AND ($1::text IS NULL OR categories.code=$1)
     ORDER BY random() LIMIT 1`,
    [category || null],
  );
  return jsonResponse({ post: result.rows[0] || null });
}
export function OPTIONS() { return corsPreflightResponse(); }
