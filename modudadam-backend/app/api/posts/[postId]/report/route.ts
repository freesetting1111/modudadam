import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { parseReport, reportErrorResponse } from "@/domains/community/report";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { postId } = await params;
    const report = parseReport(await request.json());
    const result = await query<{ found: boolean; reported: boolean }>(
      `WITH target AS (
         SELECT id FROM posts WHERE id=$2 AND status='published'
       ), inserted AS (
         INSERT INTO content_reports(reporter_id,target_type,post_id,reason_code,reason_detail)
         SELECT $1,'post',id,$3,$4 FROM target
         ON CONFLICT(reporter_id,post_id) WHERE target_type='post' DO NOTHING
         RETURNING id
       )
       SELECT EXISTS(SELECT 1 FROM target) AS found,
              EXISTS(SELECT 1 FROM inserted) AS reported`,
      [user.id, postId, report.reasonCode, report.reasonDetail],
    );
    if (!result.rows[0]?.found) return errorResponse("신고할 글을 찾을 수 없습니다.", 404);
    if (!result.rows[0].reported) return errorResponse("이미 신고한 글입니다.", 409);
    return jsonResponse({ reported: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    const validationMessage = reportErrorResponse(error);
    if (validationMessage) return errorResponse(validationMessage);
    console.error("[reports] failed to report post", error);
    return errorResponse("신고를 접수하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
