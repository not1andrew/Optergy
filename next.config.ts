import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingIncludes: {
    "/api/products": ["./data/products.sqlite"],
  },
};

export default nextConfig;
