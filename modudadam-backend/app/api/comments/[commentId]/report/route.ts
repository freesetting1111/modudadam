import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { parseReport, reportErrorResponse } from "@/domains/community/report";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";

export async function POST(request: NextRequest, { params }: { params: Promise<{ commentId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { commentId } = await params;
    const report = parseReport(await request.json());
    const result = await query<{ found: boolean; reported: boolean }>(
      `WITH target AS (
         SELECT id FROM comments WHERE id=$2 AND status='published'
       ), inserted AS (
         INSERT INTO content_reports(reporter_id,target_type,comment_id,reason_code,reason_detail)
         SELECT $1,'comment',id,$3,$4 FROM target
         ON CONFLICT(reporter_id,comment_id) WHERE target_type='comment' DO NOTHING
         RETURNING id
       )
       SELECT EXISTS(SELECT 1 FROM target) AS found,
              EXISTS(SELECT 1 FROM inserted) AS reported`,
      [user.id, commentId, report.reasonCode, report.reasonDetail],
    );
    if (!result.rows[0]?.found) return errorResponse("신고할 댓글을 찾을 수 없습니다.", 404);
    if (!result.rows[0].reported) return errorResponse("이미 신고한 댓글입니다.", 409);
    return jsonResponse({ reported: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    const validationMessage = reportErrorResponse(error);
    if (validationMessage) return errorResponse(validationMessage);
    console.error("[reports] failed to report comment", error);
    return errorResponse("신고를 접수하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
