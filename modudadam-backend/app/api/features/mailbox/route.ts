import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { getOrCreateMailboxAlias } from "@/domains/features/mailbox-alias";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { db, query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
  const limit = 20;
  const count = await query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM mailbox_posts WHERE status='published'`);
  const totalCount = count.rows[0]?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / limit));
  const currentPage = Math.min(page, totalPages);
  const result = await query(
    `SELECT posts.id,posts.author_alias AS "authorAlias",posts.title,posts.content,posts.created_at AS "createdAt",
       COUNT(comments.id)::int AS "commentCount"
     FROM mailbox_posts posts LEFT JOIN mailbox_comments comments ON comments.post_id=posts.id AND comments.status='published'
     WHERE posts.status='published' GROUP BY posts.id
     ORDER BY posts.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, (currentPage - 1) * limit],
  );
  let myAnonymousAlias: string | null = null;
  let canPostToday = Boolean(user);
  if (user) {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      myAnonymousAlias = await getOrCreateMailboxAlias(client,user.id);
      const submitted = await client.query(
        `SELECT 1 FROM mailbox_daily_submissions
          WHERE user_id=$1 AND submitted_on=(now() AT TIME ZONE 'Asia/Seoul')::date`, [user.id],
      );
      canPostToday = !submitted.rows[0];
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  return jsonResponse({ posts: result.rows, page: currentPage, pageSize: limit, totalCount, totalPages, myAnonymousAlias, canPostToday });
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    if (!title || title.length > 80) return errorResponse("제목은 1자 이상 80자 이하로 입력해 주세요.");
    if (!content || content.length > 4000) return errorResponse("사연은 1자 이상 4,000자 이하로 입력해 주세요.");
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const alias = await getOrCreateMailboxAlias(client,user.id);
      const inserted = await client.query<{ id: string; authorAlias: string }>(
        `INSERT INTO mailbox_posts(author_id,author_alias,title,content) VALUES($1,$2,$3,$4)
         RETURNING id,author_alias AS "authorAlias"`, [user.id, alias, title, content],
      );
      const post = inserted.rows[0];
      const dailySubmission = await client.query(
        `INSERT INTO mailbox_daily_submissions(user_id,submitted_on,post_id)
         VALUES($1,(now() AT TIME ZONE 'Asia/Seoul')::date,$2)
         ON CONFLICT(user_id,submitted_on) DO NOTHING RETURNING post_id`, [user.id,post.id],
      );
      if (!dailySubmission.rows[0]) throw new Error("DAILY_LIMIT");
      await client.query(
        `INSERT INTO mailbox_participants(post_id,user_id,anonymous_alias) VALUES($1,$2,$3)`,
        [post.id, user.id, post.authorAlias],
      );
      await client.query("COMMIT");
      return jsonResponse(post, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "DAILY_LIMIT") return errorResponse("익명 사연은 하루에 한 번만 보낼 수 있습니다. 내일 다시 들려주세요.", 409);
    return errorResponse("익명 사연을 등록하지 못했습니다.", 500);
  }
}
export function OPTIONS() { return corsPreflightResponse(); }
