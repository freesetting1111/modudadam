import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
