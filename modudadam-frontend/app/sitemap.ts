import type { MetadataRoute } from "next";
import { categories, specialBoards } from "@/lib/categories";
import { API_SERVER_URL } from "@/lib/server-config";
import { getSiteUrl } from "@/lib/site-url";

export const revalidate = 3600;

type SeoPostsEnvelope = { success: true; data: { posts: { id: string; updatedAt: string }[] } };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  let posts: { id: string; updatedAt: string }[] = [];
  try {
    const response = await fetch(`${API_SERVER_URL}/api/seo/posts?limit=50000`, { next: { revalidate: 3600 } });
    if (response.ok) {
      const body = await response.json() as SeoPostsEnvelope;
      if (body.success) posts = body.data.posts;
    }
  } catch { /* 정적 URL만으로도 사이트맵을 생성합니다. */ }
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/events`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/play`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/play/bounties`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/play/random`, changeFrequency: "weekly", priority: 0.7 },
    ...specialBoards.map((board) => ({ url: `${siteUrl}/category/${board.code}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...categories.map((category) => ({ url: `${siteUrl}/category/${category.code}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...posts.map((post) => ({ url: `${siteUrl}/posts/${post.id}`, lastModified: new Date(post.updatedAt), changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
