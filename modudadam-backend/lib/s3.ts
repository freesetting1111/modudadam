import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_POST_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_POST_IMAGES = 10;

const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type S3Config = {
  bucket: string;
  client: S3Client;
};

function getS3Config(): S3Config {
  const region = process.env.AWS_REGION?.trim();
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();

  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("S3_CONFIG_MISSING");
  }

  return {
    bucket,
    client: new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

export function validatePostImage(input: { mimeType: string; byteSize: number }) {
  if (!imageExtensions[input.mimeType]) return "JPG, PNG, WebP 이미지만 첨부할 수 있습니다.";
  if (!Number.isInteger(input.byteSize) || input.byteSize <= 0 || input.byteSize > MAX_POST_IMAGE_BYTES) {
    return "이미지는 파일당 10MB 이하만 첨부할 수 있습니다.";
  }
  return null;
}

export function createPostImageKey(userId: string, mimeType: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `posts/images/${year}/${month}/${day}/${userId}/${randomUUID()}.${imageExtensions[mimeType]}`;
}

export async function createImageUploadUrl(objectKey: string, mimeType: string, byteSize: number) {
  const { bucket, client } = getS3Config();
  return getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ContentType: mimeType,
    ContentLength: byteSize,
  }), { expiresIn: 10 * 60 });
}

export async function verifyUploadedImage(objectKey: string) {
  const { bucket, client } = getS3Config();
  const metadata = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
  const sample = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey, Range: "bytes=0-11" }));
  const bytes = await sample.Body?.transformToByteArray();
  if (!bytes || !matchesImageSignature(metadata.ContentType || "", bytes)) {
    throw new Error("INVALID_IMAGE_CONTENT");
  }
  return metadata;
}

export async function getPostImageUrl(objectKey: string) {
  const publicBaseUrl = process.env.AWS_S3_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
  if (publicBaseUrl) {
    return `${publicBaseUrl}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  }
  const { bucket, client } = getS3Config();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: 60 * 60 });
}

export async function deletePostImage(objectKey: string) {
  const { bucket, client } = getS3Config();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}

function matchesImageSignature(mimeType: string, bytes: Uint8Array) {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  }
  if (mimeType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}
