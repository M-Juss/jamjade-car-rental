import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io"],
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
      },
      {
        protocol: "https",
        hostname: "*.ngrok-free.app",
      },
      {
        protocol: "https",
        hostname: "*.ngrok-free.dev",
      },
      {
        protocol: "https",
        hostname: "*.ngrok.io",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/admin/(vehicles|bookings|maintenance|maintenance-plans|customers|reports|payments|document-verification|fleet-tracker)/:path*",
        destination: `${backendUrl}/admin/$1/:path*`,
      },
      {
        source: "/admin/(login|me|logout|dashboard)",
        destination: `${backendUrl}/admin/$1`,
      },
      {
        source: "/sanctum/:path*",
        destination: `${backendUrl}/sanctum/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/storage/:path*",
        destination: `${backendUrl}/storage/:path*`,
      },
    ];
  },
};

export default nextConfig;
