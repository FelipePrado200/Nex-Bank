import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needed for Three.js / R3F in App Router
  serverExternalPackages: ["three"],
  devIndicators: false,
  // Allow WebGL canvas to run without CSP issues in dev
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
      ],
    },
  ],
};

export default nextConfig;
