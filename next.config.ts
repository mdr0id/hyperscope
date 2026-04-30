import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  outputFileTracingIncludes: {
    "/api/grpc": ["./proto/**/*"],
  },
  serverExternalPackages: ["@grpc/grpc-js", "@grpc/proto-loader", "@mongodb-js/zstd"],
};

export default nextConfig;
