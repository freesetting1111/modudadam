import "server-only";
import { cache } from "react";
import { API_SERVER_URL } from "@/lib/server-config";

export type PublicPost = {
  id: string; title: string; content: string; authorName: string; authorStampEmoji: string | null;
  categoryCode: string; categoryName: string; viewCount: number; commentCount: number;
  createdAt: string; publishedAt?: string; updatedAt: string; canEdit: boolean; canReport: boolean;
  isLiked: boolean; likeCount: number; isBookmarked: boolean; bookmarkCount: number;
  renderedContentHtml: string;
  bounty: null | {
    id:string;amount:number;awardAmount:number;feeAmount:number;status:"open"|"awarded"|"refunded";
    expiresAt:string;acceptedCommentId:string|null;recipientName:string|null;canAward:boolean;canRefund:boolean;
  };
  images: { id: string; url: string; originalName: string; mimeType: string; byteSize: number }[];
};

type PostEnvelope = { success: true; data: { post: PublicPost } } | { success: false };

export type PublicPostAnswer = {
  id:string;parentId:string|null;status:"published"|"deleted";content:string;authorName:string;
  createdAt:string;updatedAt:string;likeCount:number;dislikeCount:number;isBountyWinner:boolean;
};
export type PublicPostAnswers = {
  comments:PublicPostAnswer[];
  pagination:{ page:number;pageSize:number;totalItems:number;totalPages:number;publishedRootCount:number;commentCount:number };
};

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

export const getPublicPostAnswers = cache(async (postId:string):Promise<PublicPostAnswers> => {
  const empty={ comments:[],pagination:{ page:1,pageSize:20,totalItems:0,totalPages:1,publishedRootCount:0,commentCount:0 } };
  try {
    const response=await fetch(`${API_SERVER_URL}/api/posts/${encodeURIComponent(postId)}/comments?page=1&pageSize=20`,{ cache:"no-store" });
    if(!response.ok) return empty;
    const body=await response.json() as { success?:boolean;data?:PublicPostAnswers };
    return body.success&&body.data ? body.data : empty;
  } catch { return empty; }
});
