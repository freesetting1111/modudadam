import type { NextRequest } from "next/server";
import { getSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

const ADMIN_EMAIL="freesetting@naver.com";
const PAGE_SIZE=20;

async function admin(request:NextRequest) {
  const user=await getSessionUser(request);
  if (!user) return null;
  return user.email?.trim().toLowerCase()===ADMIN_EMAIL ? user : false;
}

export async function GET(request:NextRequest) {
  const user=await admin(request);if (user===null) return errorResponse("로그인이 필요합니다.",401);if (!user) return errorResponse("권한이 없습니다.",403);
  const status=request.nextUrl.searchParams.get("status") || "pending";
  if (!["pending","reviewed","dismissed","actioned"].includes(status)) return errorResponse("상태를 확인해 주세요.");
  const requested=Math.max(1,Number(request.nextUrl.searchParams.get("page")) || 1);
  const count=await query<{ count:number }>(`SELECT count(*)::int AS count FROM content_reports WHERE status=$1`,[status]);
  const total=count.rows[0]?.count || 0;const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));const page=Math.min(requested,totalPages);
  const reports=await query(`SELECT reports.id::text,reports.target_type AS "targetType",reports.reason_code AS "reasonCode",reports.reason_detail AS "reasonDetail",reports.status,reports.created_at AS "createdAt",reporter.nickname AS "reporterName",target.id AS "targetUserId",target.nickname AS "targetName",COALESCE(posts.title,left(comments.content,120)) AS "targetContent" FROM content_reports reports JOIN users reporter ON reporter.id=reports.reporter_id LEFT JOIN posts ON reports.target_type='post' AND posts.id=reports.post_id LEFT JOIN comments ON reports.target_type='comment' AND comments.id=reports.comment_id LEFT JOIN users target ON target.id=COALESCE(posts.author_id,comments.author_id) WHERE reports.status=$1 ORDER BY reports.created_at DESC,reports.id DESC LIMIT $2 OFFSET $3`,[status,PAGE_SIZE,(page-1)*PAGE_SIZE]);
  return jsonResponse({ reports:reports.rows,total,page,totalPages,pageSize:PAGE_SIZE });
}

export async function POST(request:NextRequest) {
  const user=await admin(request);if (user===null) return errorResponse("로그인이 필요합니다.",401);if (!user) return errorResponse("권한이 없습니다.",403);
  const body=await request.json();const id=String(body.id || "");const status=String(body.status || "");
  if (!/^\d+$/.test(id) || !["actioned","dismissed"].includes(status)) return errorResponse("처리 내용을 확인해 주세요.");
  const updated=await query(`UPDATE content_reports SET status=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$1::bigint AND status IN ('pending','reviewed') RETURNING id`,[id,status,user.id]);
  if (!updated.rows[0]) return errorResponse("이미 처리됐거나 찾을 수 없는 신고입니다.",409);
  return jsonResponse({ reviewed:true,status });
}

export function OPTIONS(){ return corsPreflightResponse(); }
