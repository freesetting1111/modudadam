import type { NextRequest } from "next/server";
import { requireSessionUser } from "@/domains/auth/session";
import { query } from "@/lib/db";
import { corsPreflightResponse, errorResponse, jsonResponse } from "@/lib/http";
import { verifyUploadedImage } from "@/lib/s3";

type PendingImage = { id: string; objectKey: string; mimeType: string; byteSize: string };

export async function POST(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  try {
    const user = await requireSessionUser(request);
    const { uploadId } = await params;
    const result = await query<PendingImage>(
      `SELECT id,object_key AS "objectKey",mime_type AS "mimeType",byte_size::text AS "byteSize"
       FROM post_images WHERE id=$1 AND owner_id=$2 AND post_id IS NULL AND status='pending'`,
      [uploadId, user.id],
    );
    const image = result.rows[0];
    if (!image) return errorResponse("완료할 이미지 업로드를 찾을 수 없습니다.", 404);

    const uploaded = await verifyUploadedImage(image.objectKey);
    if (uploaded.ContentLength !== Number(image.byteSize) || uploaded.ContentType !== image.mimeType) {
      return errorResponse("업로드된 이미지 정보가 요청과 일치하지 않습니다.");
    }

    await query("UPDATE post_images SET status='ready' WHERE id=$1 AND status='pending'", [image.id]);
    return jsonResponse({ id: image.id });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("로그인이 필요합니다.", 401);
    if (error instanceof Error && error.message === "S3_CONFIG_MISSING") return errorResponse("파일 저장소 설정이 완료되지 않았습니다.", 503);
    if (error instanceof Error && error.message === "INVALID_IMAGE_CONTENT") return errorResponse("실제 이미지 파일만 업로드할 수 있습니다.");
    console.error("[uploads] failed to verify upload", error);
    return errorResponse("이미지 업로드 완료를 확인하지 못했습니다.", 500);
  }
}

export function OPTIONS() { return corsPreflightResponse(); }
