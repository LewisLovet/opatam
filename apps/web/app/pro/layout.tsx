'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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
  const isExpired =
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

          {/* Desktop top bar — notification center, right-aligned */}
          <div className="hidden lg:flex items-center justify-end h-14 px-8 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-sm sticky top-0 z-30">
            <NotificationsBell variant="dark" />
          </div>

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
        </div>

        {isAccessBlocked && <TrialExpiredBanner />}
      </div>
    </AuthGuard>
  );
}
