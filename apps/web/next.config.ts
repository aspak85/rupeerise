import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: turn every page into pre-rendered HTML/JS so we deploy
  // zero serverless functions (Vercel Hobby plan limits us to 12). All data
  // fetching happens client-side against the Render API via /api/* rewrite.
  output: "export",
  images: {
    // next/image cannot run server-side optimization in static export.
    unoptimized: true,
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
