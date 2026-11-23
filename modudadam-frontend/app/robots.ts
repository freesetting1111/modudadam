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
        "/play/attendance",
        "/play/challenges",
        "/play/choice",
        "/play/detective",
        "/play/mailbox",
        "/play/missions",
        "/play/stamps",
        "/play/taste",
        "/play/time-capsule",
        "/play/treasures",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
