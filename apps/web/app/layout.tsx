import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { APP_CONFIG } from '@booking-app/shared';
import { DevTools } from '@/components/dev/DevTools';

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
      <body className="antialiased">
        <Providers>{children as ReactNode}</Providers>
        <DevTools />
      </body>
    </html>
  );
}
