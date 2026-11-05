import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    return [
      {
        source: "/auth/:path*",
        destination: `${apiUrl}/auth/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: "/dashboard-api/:path*",
        destination: `${apiUrl}/dashboard-api/:path*`,
      },
    ];
  },
};

export default nextConfig;