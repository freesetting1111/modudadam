import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { createImageUploadUrl, createPostImageKey, validatePostImage } from "@/lib/s3";

export async function POST(request: NextRequest) {
  try {
    const user = await requireSessionUser(request);
    const body = await request.json();
    const originalName = String(body.fileName || "image").trim().slice(0, 255) || "image";
    const mimeType = String(body.mimeType || "").toLowerCase();
    const byteSize = Number(body.byteSize);
    const validationError = validatePostImage({ mimeType, byteSize });
    if (validationError) return errorResponse(validationError);

    const objectKey = createPostImageKey(user.id, mimeType);
    const result = await query<{ id: string }>(
      `INSERT INTO post_images(owner_id,object_key,original_name,mime_type,byte_size)
       VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [user.id, objectKey, originalName, mimeType, byteSize],
    );

    try {
      const uploadUrl = await createImageUploadUrl(objectKey, mimeType, byteSize);
      return jsonResponse({ id: result.rows[0].id, uploadUrl, objectKey }, { status: 201 });
    } catch (error) {
      await query("DELETE FROM post_images WHERE id=$1 AND post_id IS NULL", [result.rows[0].id]);
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "S3_CONFIG_MISSING") return errorResponse("파일 저장소 설정이 완료되지 않았습니다.", 503);
    console.error("[uploads] failed to create upload URL", error);
    return errorResponse("이미지 업로드를 준비하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
