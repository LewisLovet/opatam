import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { Providers } from './providers';
import { APP_CONFIG } from '@booking-app/shared';
import { ClarityScript } from '@/components/analytics/ClarityScript';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const BASE_URL = 'https://opatam.com';
const SITE_NAME = APP_CONFIG.name;
const DEFAULT_DESCRIPTION =
  'Opatam est la plateforme de réservation en ligne pour les entrepreneurs de la beauté, du bien-être et des services. Gérez vos rendez-vous, attirez de nouveaux clients, sans commission.';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    template: `%s | ${SITE_NAME}`,
    default: `${SITE_NAME} - Réservation en ligne pour entrepreneurs`,
  },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: SITE_NAME,
    title: `${SITE_NAME} - Réservation en ligne pour entrepreneurs`,
    description: DEFAULT_DESCRIPTION,
    url: BASE_URL,
  },
  twitter: {
    card: 'summary',
    title: `${SITE_NAME} - Réservation en ligne pour entrepreneurs`,
    description: DEFAULT_DESCRIPTION,
  },
  alternates: {
    canonical: BASE_URL,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <head>
        <meta name="apple-itunes-app" content="app-id=6759246218" />
      </head>
      <body className="antialiased">
        <Providers>{children as ReactNode}</Providers>
        {/* ── Analytics ─────────────────────────────────────────────
            - Vercel Analytics: page-view counts + top pages /
              referrers / countries. Auto-enabled on Vercel deploys.
            - Vercel Speed Insights: Core Web Vitals from real users.
            - Microsoft Clarity: heatmaps + session recordings.
              Renders nothing unless NEXT_PUBLIC_CLARITY_PROJECT_ID
              is set, so local dev stays clean.
            All three are no-cookie / privacy-friendly so we don't
            need a consent banner. */}
        <Analytics />
        <SpeedInsights />
        <ClarityScript />
      </body>
    </html>
  );
}
