import type { NextConfig } from 'next';

// Force Europe/Paris timezone on the server (Vercel runs in UTC by default).
// This ensures new Date(), setHours(), etc. use Paris time consistently,
// which is critical for the scheduling/booking system.
process.env.TZ = 'Europe/Paris';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@booking-app/shared',
    '@booking-app/theme',
    '@booking-app/firebase',
    '@booking-app/ui',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
