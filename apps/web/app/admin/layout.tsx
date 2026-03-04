'use client';

import { useState } from 'react';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { AdminSidebar, AdminMobileSidebar, AdminMobileHeader } from './components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        {/* Desktop sidebar */}
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Mobile sidebar */}
        <AdminMobileSidebar
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
          {/* Mobile header */}
          <AdminMobileHeader onMenuClick={() => setMobileMenuOpen(true)} />

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </AdminGuard>
  );
}
