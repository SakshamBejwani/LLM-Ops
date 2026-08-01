import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's default gzip compression buffers the whole response body before
  // sending, which defeats real streaming (SSE dashboard feed, chat tokens).
  compress: false,
};

export default nextConfig;
