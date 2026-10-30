import type { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requireSessionUser } from "@/domains/auth/session";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const result = await query(
    `UPDATE posts SET view_count=view_count+1 WHERE id=$1 AND status='published'
     RETURNING id`, [postId]);
  if (!result.rows[0]) return errorResponse("글을 찾을 수 없습니다.", 404);
  const detail = await query(
    `SELECT posts.id,posts.title,posts.summary,posts.content,posts.attributes,
      posts.post_type AS "postType",posts.view_count AS "viewCount",posts.comment_count AS "commentCount",
      posts.published_at AS "publishedAt",posts.created_at AS "createdAt",posts.updated_at AS "updatedAt",
      categories.code AS "categoryCode",categories.name AS "categoryName",
      users.id AS "authorId",COALESCE(local_account.login_id,users.nickname) AS "authorName"
     FROM posts JOIN categories ON categories.id=posts.category_id JOIN users ON users.id=posts.author_id
     LEFT JOIN user_local_accounts local_account ON local_account.user_id=users.id
     WHERE posts.id=$1 AND posts.status='published'`, [postId]);
  return jsonResponse({ post: detail.rows[0] });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user = await requireSessionUser(request); const { postId } = await params; const body = await request.json();
    const result = await query<{ id: string }>(
      `UPDATE posts SET title=COALESCE($3,title),summary=COALESCE($4,summary),content=COALESCE($5,content),
       attributes=COALESCE($6::jsonb,attributes),updated_at=now()
       WHERE id=$1 AND author_id=$2 AND status<>'deleted' RETURNING id`,
      [postId,user.id,body.title?.trim()||null,body.summary?.trim()||null,body.content?.trim()||null,body.attributes?JSON.stringify(body.attributes):null]);
    return result.rows[0] ? jsonResponse({ id: postId }) : errorResponse("수정 권한이 없거나 글이 없습니다.", 404);
  } catch (error) { return error instanceof Error && error.message === "UNAUTHORIZED" ? errorResponse("로그인이 필요합니다.",401) : errorResponse("수정하지 못했습니다.",500); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user=await requireSessionUser(request); const { postId }=await params;
    const result=await query<{id:string}>("UPDATE posts SET status='deleted',deleted_at=now(),updated_at=now() WHERE id=$1 AND author_id=$2 RETURNING id",[postId,user.id]);
    return result.rows[0]?jsonResponse({id:postId}):errorResponse("삭제 권한이 없거나 글이 없습니다.",404);
  } catch(error){return error instanceof Error&&error.message==="UNAUTHORIZED"?errorResponse("로그인이 필요합니다.",401):errorResponse("삭제하지 못했습니다.",500);}
}
export function OPTIONS(){return corsPreflightResponse();}
