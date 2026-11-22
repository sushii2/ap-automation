import type { NextConfig } from "next"

import { securityHeaders } from "./lib/security-headers"

const nextConfig: NextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/crypto"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
}

export default nextConfig
