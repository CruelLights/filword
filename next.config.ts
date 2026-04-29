import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws"],
  reactStrictMode: false,
};

export default nextConfig;
