'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAccessOverrideActive } from '@booking-app/shared';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { TrialExpiredBanner } from '@/components/auth/TrialExpiredBanner';
import { Sidebar, MobileSidebar, MobileHeader } from './components/Sidebar';
import { NotificationsBell } from './components/NotificationsBell';

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const { provider } = useAuth();

  // Block access when validUntil is in the past — EXCEPT on the pages the
  // pro needs to reactivate: settings and the subscription page itself.
  // (Without /pro/abonnement here, the banner's "Voir les plans" CTA led
  // to a page that was still blocked → the modal looped.)
  const subscription = provider?.subscription;
  // A manual "comp" access grant (admin-given, independent of Stripe) overrides
  // any expiry → the pro is never blocked while it's active.
  const overrideActive = isAccessOverrideActive(provider?.accessOverride);
  const isExpired =
    !overrideActive &&
    !!subscription?.validUntil && new Date(subscription.validUntil) < new Date();
  const isOnAllowedPage =
    pathname?.startsWith('/pro/parametres') || pathname?.startsWith('/pro/abonnement');
  const isAccessBlocked = isExpired && !isOnAllowedPage;

  return (
    <AuthGuard requireProvider={true}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        {/* Desktop sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Mobile sidebar */}
        <MobileSidebar
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
          {/* Mobile header */}
          <MobileHeader onMenuClick={() => setMobileMenuOpen(true)} />

          {/* Page content. The notification bell floats in the top-right of
              the content area — same line as each page's title, with no
              separator bar (the old bordered top bar split the page in two). */}
          <main className="relative flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
            <div className="hidden lg:block absolute top-5 right-6 lg:top-6 lg:right-8 z-30">
              {/* Frosted chip so the bell stays legible on any page — over the
                  blue hero here, or on the plain gray dashboard elsewhere. */}
              <div className="rounded-full bg-white/80 dark:bg-gray-800/70 shadow-sm ring-1 ring-black/5 dark:ring-white/10 backdrop-blur">
                <NotificationsBell variant="dark" />
              </div>
            </div>
            {children}
          </main>
        </div>

        {isAccessBlocked && <TrialExpiredBanner />}
      </div>
    </AuthGuard>
  );
}
