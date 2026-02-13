import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Capacitor iOS shell (no server needed)
  output: "export",
};

export default nextConfig;
