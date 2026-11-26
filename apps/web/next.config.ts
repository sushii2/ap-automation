import { securityHeaders } from "./lib/security-headers";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/crypto"],
  poweredByHeader: false,
  experimental: {
    // The proxy buffers request bodies; uploads go up to 25 MB.
    proxyClientMaxBodySize: "26mb",
  },
  headers: async () => [{ source: "/:path*", headers: securityHeaders }],
};

export default nextConfig;
