import type { Metadata } from 'next';
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

export const metadata: Metadata = {
  title: `${APP_CONFIG.name} - Reservez en ligne`,
  description: 'Plateforme de reservation multi-secteurs pour prestataires de services',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <DevTools />
      </body>
    </html>
  );
}
