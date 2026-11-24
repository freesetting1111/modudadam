import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { db } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

type Context = { params: Promise<{ treasureId:string }> };

export async function POST(request:NextRequest,{ params }:Context) {
  const client=await db.connect();
  try {
    const user=await requireSessionUser(request);
    const { treasureId }=await params;
    if(!isUuid(treasureId)) return errorResponse("장소 정보를 확인해 주세요.");

    await client.query("BEGIN");
    const treasure=await client.query<{ authorId:string }>(
      `SELECT author_id AS "authorId" FROM local_treasures
       WHERE id=$1::uuid AND status='published' FOR UPDATE`,[treasureId],
    );
    if(!treasure.rows[0]) { await client.query("ROLLBACK");return errorResponse("장소를 찾을 수 없습니다.",404); }
    if(treasure.rows[0].authorId===user.id) { await client.query("ROLLBACK");return errorResponse("본인이 등록한 장소에는 좋아요를 누를 수 없습니다.",409); }

    await client.query(
      `INSERT INTO local_treasure_likes(treasure_id,user_id)
       VALUES($1::uuid,$2::uuid) ON CONFLICT(treasure_id,user_id) DO NOTHING`,
      [treasureId,user.id],
    );
    const count=await client.query<{ likeCount:number }>(
      `SELECT count(*)::int AS "likeCount" FROM local_treasure_likes WHERE treasure_id=$1::uuid`,
      [treasureId],
    );
    await client.query("COMMIT");
    return jsonResponse({ liked:true,likeCount:count.rows[0]?.likeCount || 0 });
  } catch(error) {
    await client.query("ROLLBACK");
    if(error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("좋아요를 반영하지 못했습니다.",500);
  } finally { client.release(); }
}

export async function DELETE(request:NextRequest,{ params }:Context) {
  const client=await db.connect();
  try {
    const user=await requireSessionUser(request);
    const { treasureId }=await params;
    if(!isUuid(treasureId)) return errorResponse("장소 정보를 확인해 주세요.");

    await client.query("BEGIN");
    await client.query(
      `DELETE FROM local_treasure_likes WHERE treasure_id=$1::uuid AND user_id=$2::uuid`,
      [treasureId,user.id],
    );
    const count=await client.query<{ likeCount:number }>(
      `SELECT count(*)::int AS "likeCount" FROM local_treasure_likes WHERE treasure_id=$1::uuid`,
      [treasureId],
    );
    await client.query("COMMIT");
    return jsonResponse({ liked:false,likeCount:count.rows[0]?.likeCount || 0 });
  } catch(error) {
    await client.query("ROLLBACK");
    if(error instanceof Error && error.message==="UNAUTHORIZED") return errorResponse("로그인이 필요합니다.",401);
    return errorResponse("좋아요를 취소하지 못했습니다.",500);
  } finally { client.release(); }
}

function isUuid(value:string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
export function OPTIONS() { return corsPreflightResponse(); }
