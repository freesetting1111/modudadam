import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    agentUpgrade: "security",
  },
  async headers() {
    return [
      {
        source: "/robots.txt",
        headers: [{ key:"Cache-Control",value:"public, max-age=0, s-maxage=3600, must-revalidate" }],
      },
      {
        source: "/sitemap.xml",
        headers: [{ key:"Cache-Control",value:"public, max-age=0, s-maxage=3600, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
