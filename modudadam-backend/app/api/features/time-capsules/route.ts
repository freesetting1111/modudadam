import type { NextRequest } from "next/server";
import { getSessionUser, requireSessionUser } from "@/domains/auth/session";
import { db, query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const PAGE_SIZE = 10;

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    const scope = request.nextUrl.searchParams.get("scope") === "public" ? "public" : "mine";
    if (scope === "mine" && !user) return errorResponse("내 타임캡슐을 확인하려면 로그인이 필요합니다.",401);
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page")) || 1);
    const offset = (page - 1) * PAGE_SIZE;
    const condition = scope === "public"
      ? `status='opened' AND visibility='public'`
      : `user_id=$1::uuid AND status<>'deleted'`;
    const params = scope === "public" ? [PAGE_SIZE, offset] : [user!.id, PAGE_SIZE, offset];
    const limitIndex = scope === "public" ? 1 : 2;
    const offsetIndex = scope === "public" ? 2 : 3;
    const [items, count] = await Promise.all([
      query<{
        id:string;title:string;content:string | null;visibility:"private"|"public";status:"sealed"|"opened";
        opensAt:string;openedAt:string | null;createdAt:string;canOpen:boolean;
      }>(
        `SELECT id,title,CASE WHEN status='opened' THEN content ELSE NULL END AS content,
          visibility,status,opens_at AS "opensAt",opened_at AS "openedAt",created_at AS "createdAt",
          (status='sealed' AND opens_at<=now()) AS "canOpen"
         FROM time_capsules WHERE ${condition}
         ORDER BY CASE WHEN status='sealed' THEN opens_at ELSE opened_at END DESC
         LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
        params,
      ),
      scope === "public"
        ? query<{ count:number }>(`SELECT count(*)::int AS count FROM time_capsules WHERE ${condition}`)
        : query<{ count:number }>(`SELECT count(*)::int AS count FROM time_capsules WHERE ${condition}`,[user!.id]),
    ]);
    return jsonResponse({
      items: items.rows,
      page,
      totalPages: Math.max(1, Math.ceil((count.rows[0]?.count || 0) / PAGE_SIZE)),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("타임캡슐을 이용하려면 로그인이 필요합니다.",401);
    console.error("[time-capsules] failed to load",error);
    return errorResponse("타임캡슐을 불러오지 못했습니다.",500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json() as Record<string,unknown>;
    if (body.action === "open") return await openCapsule(user.id,String(body.id || ""));

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const visibility = body.visibility === "public" ? "public" : "private";
    const opensAt = new Date(String(body.opensAt || ""));
    const now = Date.now();
    if (title.length < 2 || title.length > 80) return errorResponse("제목은 2자 이상 80자 이하로 입력해 주세요.");
    if (content.length < 10 || content.length > 4000) return errorResponse("편지는 10자 이상 4,000자 이하로 입력해 주세요.");
    if (Number.isNaN(opensAt.getTime()) || opensAt.getTime() < now + 60_000 || opensAt.getTime() > now + 3660 * 86_400_000) return errorResponse("개봉 날짜를 현재 이후 10년 이내로 선택해 주세요.");
    const inserted = await query<{ id:string }>(
      `INSERT INTO time_capsules(user_id,title,content,visibility,opens_at)
       VALUES($1,$2,$3,$4,$5::timestamptz) RETURNING id`,
      [user.id,title,content,visibility,opensAt.toISOString()],
    );
    return jsonResponse({ id:inserted.rows[0].id },{ status:201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("타임캡슐을 이용하려면 로그인이 필요합니다.",401);
    console.error("[time-capsules] failed to save",error);
    return errorResponse("타임캡슐을 봉인하지 못했습니다.",500);
  }
}

async function openCapsule(userId:string,id:string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return errorResponse("타임캡슐을 확인해 주세요.");
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const capsule = await client.query<{ title:string;content:string;visibility:string;status:string;opensAt:Date }>(
      `SELECT title,content,visibility,status,opens_at AS "opensAt" FROM time_capsules
       WHERE id=$1::uuid AND user_id=$2::uuid AND status<>'deleted' FOR UPDATE`,[id,userId],
    );
    const current = capsule.rows[0];
    if (!current) { await client.query("ROLLBACK"); return errorResponse("타임캡슐을 찾을 수 없습니다.",404); }
    if (current.status === "opened") { await client.query("COMMIT"); return jsonResponse({ opened:true,content:current.content }); }
    if (new Date(current.opensAt).getTime() > Date.now()) { await client.query("ROLLBACK"); return errorResponse("아직 개봉할 시간이 되지 않았어요.",423); }
    await client.query(`UPDATE time_capsules SET status='opened',opened_at=now(),updated_at=now() WHERE id=$1`,[id]);
    await client.query("COMMIT");
    return jsonResponse({ opened:true,content:current.content });
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

export function OPTIONS() { return corsPreflightResponse(); }
