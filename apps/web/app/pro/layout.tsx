'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { TrialExpiredBanner } from '@/components/auth/TrialExpiredBanner';
import { Sidebar, MobileSidebar, MobileHeader } from './components/Sidebar';

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const { provider } = useAuth();

  // Block access when validUntil is in the past (except on settings page)
  const subscription = provider?.subscription;
  const isExpired =
    !!subscription?.validUntil && new Date(subscription.validUntil) < new Date();
  const isOnSettingsPage = pathname?.startsWith('/pro/parametres');
  const isAccessBlocked = isExpired && !isOnSettingsPage;

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

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
        </div>

        {isAccessBlocked && <TrialExpiredBanner />}
      </div>
    </AuthGuard>
  );
}
