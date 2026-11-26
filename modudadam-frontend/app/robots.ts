import type { MetadataRoute } from "next";
import { publicPlayFeaturePaths } from "@/lib/public-play-features";
import { getSiteUrl } from "@/lib/site-url";

const publicPlayPaths = [
  "/play",
  "/play/bounties",
  "/play/challenges",
  "/play/random",
  ...publicPlayFeaturePaths,
];

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      // 네이버 Yeti를 포함한 검색봇이 공개 콘텐츠 경로를 명확히 수집할 수 있게 합니다.
      allow: ["/",...publicPlayPaths],
      disallow: [
        "/api/",
        "/my",
        "/login",
        "/signup",
        "/account/",
        "/write",
        "/category/*/write",
        "/posts/*/edit",
        "/play/acorn-gift",
        "/play/bounties/write",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
