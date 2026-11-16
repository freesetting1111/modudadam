import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { deletePostImage } from "@/lib/s3";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { uploadId } = await params;
    const result = await query<{ objectKey: string }>(
      `SELECT object_key AS "objectKey" FROM post_images
       WHERE id=$1 AND owner_id=$2 AND post_id IS NULL AND status IN ('pending','ready')`,
      [uploadId, user.id],
    );
    const image = result.rows[0];
    if (!image) return errorResponse("삭제할 이미지를 찾을 수 없습니다.", 404);
    await deletePostImage(image.objectKey);
    await query(
      "DELETE FROM post_images WHERE id=$1 AND owner_id=$2 AND post_id IS NULL AND status IN ('pending','ready')",
      [uploadId, user.id],
    );
    return jsonResponse({ id: uploadId });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    console.error("[uploads] failed to delete upload", error);
    return errorResponse("이미지를 삭제하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
