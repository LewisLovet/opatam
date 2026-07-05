import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Force Europe/Paris timezone on the server (Vercel runs in UTC by default).
// This ensures new Date(), setHours(), etc. use Paris time consistently,
// which is critical for the scheduling/booking system.
process.env.TZ = 'Europe/Paris';

// i18n — resolves the request locale (cookie → Accept-Language → fr) and
// loads the matching dictionary from @booking-app/i18n. See i18n/request.ts.
const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@booking-app/shared',
    '@booking-app/theme',
    '@booking-app/firebase',
    '@booking-app/ui',
    '@booking-app/i18n',
  ],
  images: {
    // Serve images straight from their source (Firebase Storage — already
    // a CDN) instead of routing them through Vercel's Image Optimization.
    // That optimizer is metered/billed: once its quota is hit it returns
    // 402 on /_next/image and every <Image> breaks (the search results
    // cover photos went blank for exactly this reason). We don't need
    // per-request resizing here, so opting out removes the failure mode
    // and the cost entirely.
    unoptimized: true,
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
      {
        // Author avatar default (https://opatam.com/icon.png) used on blog articles
        protocol: 'https',
        hostname: 'opatam.com',
      },
      {
        // YouTube auto-generated video thumbnails (i.ytimg.com/vi/{id}/...).
        // Used as a fallback cover image on article cards when an article
        // has a video but no explicit cover.
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
  async headers() {
    return [
      {
        // Embeddable booking widget pages — must be iframable from any origin.
        source: '/p/:slug/embed',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          // Explicitly unset X-Frame-Options (some proxies inject SAMEORIGIN by default).
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
      {
        // Loader script for the widget — served cross-origin with short cache.
        source: '/embed.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=300, s-maxage=3600' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
