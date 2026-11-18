import "server-only";
import { cache } from "react";
import { API_SERVER_URL } from "@/lib/server-config";

export type PublicPost = {
  id: string; title: string; content: string; authorName: string; authorStampEmoji: string | null;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number;
  createdAt: string; publishedAt?: string; updatedAt: string; canEdit: boolean; canReport: boolean;
  isLiked: boolean; likeCount: number; isBookmarked: boolean; bookmarkCount: number;
  renderedContentHtml: string;
  images: { id: string; url: string; originalName: string; mimeType: string; byteSize: number }[];
};

type PostEnvelope = { success: true; data: { post: PublicPost } } | { success: false };

export const getPublicPost = cache(async (postId: string, cookieHeader = "") => {
  try {
    const response = await fetch(`${API_SERVER_URL}/api/posts/${encodeURIComponent(postId)}?trackView=false`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!response.ok) return null;
    const body = await response.json() as PostEnvelope;
    return body.success ? body.data.post : null;
  } catch { return null; }
});
