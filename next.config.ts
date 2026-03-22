import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  webpack: (config) => {
    return config;
  },
  turbopack: {},
  images: {
    // Use Next.js image optimizer for faster perceived loads (resized/cached).
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "*.firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.app",
      },
      {
        protocol: "https",
        hostname: "*.firebasestorage.app",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    qualities: [42, 60, 75, 85],
  },
  compress: true,
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico|woff|woff2|ttf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com https://www.google.com https://www.gstatic.com https://apis.google.com https://js.stripe.com https://*.stripe.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob: https://*.firebasestorage.googleapis.com https://*.firebasestorage.app; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudfunctions.net wss://*.firebaseio.com https://www.google.com https://apis.google.com https://api.stripe.com https://*.stripe.com; frame-src 'self' https://*.google.com https://www.google.com https://*.firebaseapp.com https://js.stripe.com https://hooks.stripe.com; object-src 'none'; base-uri 'self';",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      "firebase",
      "firebase-admin",
      "framer-motion",
      "react-phone-number-input",
      "react-quill",
      "recharts",
      "@stripe/react-stripe-js",
      "@stripe/stripe-js",
    ],
  },
};

export default nextConfig;
