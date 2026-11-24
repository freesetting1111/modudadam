import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
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
