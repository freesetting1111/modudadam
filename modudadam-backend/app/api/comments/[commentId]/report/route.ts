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
    const target = await query<{ authorId: string }>(
      `SELECT author_id AS "authorId" FROM comments WHERE id=$1 AND status='published'`, [commentId],
    );
    if (!target.rows[0]) return errorResponse("신고할 댓글을 찾을 수 없습니다.", 404);
    if (target.rows[0].authorId === user.id) return errorResponse("내가 작성한 댓글은 신고할 수 없습니다.");
    await query(
      `INSERT INTO content_reports(reporter_id,target_type,comment_id,reason_code,reason_detail)
       VALUES($1,'comment',$2,$3,$4)`,
      [user.id, commentId, report.reasonCode, report.reasonDetail],
    );
    return jsonResponse({ reported: true }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    const validationMessage = reportErrorResponse(error);
    if (validationMessage) return errorResponse(validationMessage);
    if (typeof error === "object" && error && "code" in error && error.code === "23505") return errorResponse("이미 신고한 댓글입니다.", 409);
    console.error("[reports] failed to report comment", error);
    return errorResponse("신고를 접수하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
