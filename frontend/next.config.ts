import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "medispa-ui.ngrok-free.dev",
    "*.ngrok-free.dev",
  ],
};

export default nextConfig;
