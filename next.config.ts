import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  outputFileTracingIncludes: {
    '/*': ['./prisma/dev.db'],
    '/api/**/*': ['./prisma/dev.db'],
    '/play/**/*': ['./prisma/dev.db']
  }
};

export default nextConfig;
