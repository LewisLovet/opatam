import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Providers } from './providers';
import { APP_CONFIG } from '@booking-app/shared';
import { ClarityScript } from '@/components/analytics/ClarityScript';
import { MetaPixel } from '@/components/analytics/MetaPixel';
import { ConsentBanner } from '@/components/analytics/ConsentBanner';
import { ChunkReloadGuard } from '@/components/ChunkReloadGuard';

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

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Locale resolved per request (cookie → Accept-Language → fr), see
  // i18n/request.ts. Drives <html lang> and the messages available to
  // every useTranslations() call in the tree.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className={inter.variable}>
      <head>
        <meta name="apple-itunes-app" content="app-id=6759246218" />
      </head>
      <body className="antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
        <Providers>
          {children as ReactNode}
          {/* ── Consented analytics ───────────────────────────────
              Meta Pixel drops the `_fbp` cookie and shares hits
              with Facebook, so it's gated behind the consent
              banner. Lives INSIDE <Providers> because it consumes
              useAuth() for Advanced Matching (hashed email/UID
              forwarded to Meta on login). Wrapped in a Suspense
              boundary because <MetaPixel> also uses
              useSearchParams() to fire PageView on route changes
              — App Router requires this for static-prerender
              paths to stay opt-in. */}
          <Suspense fallback={null}>
            <MetaPixel />
          </Suspense>
          <ConsentBanner />
        </Providers>
        </NextIntlClientProvider>
        {/* ── Analytics ─────────────────────────────────────────────
            - Vercel Analytics: page-view counts + top pages /
              referrers / countries. Auto-enabled on Vercel deploys.
            - Vercel Speed Insights: Core Web Vitals from real users.
            - Microsoft Clarity: heatmaps + session recordings with
              IP anonymisation.
            All three are no-cookie / aggregate-only and don't
            require explicit consent — they stay outside the
            <ConsentBanner> gate. */}
        <Analytics />
        <SpeedInsights />
        <ClarityScript />
        <ChunkReloadGuard />
      </body>
    </html>
  );
}
