import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
