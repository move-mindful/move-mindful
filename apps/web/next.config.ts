import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Instructor avatar uploads go through a Server Action; raise the request body
  // limit above the 1MB default to cover the fallback (un-resized) upload path.
  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.mux.com",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default nextConfig;
