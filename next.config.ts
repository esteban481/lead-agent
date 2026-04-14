import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel Cron Jobs
  async headers() {
    return [];
  },
};

export default nextConfig;
