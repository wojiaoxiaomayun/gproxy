import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  distDir: 'out',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // 对于客户端路由，我们使用 fallback 页面
  // 动态路由将在客户端处理
};

export default nextConfig;
