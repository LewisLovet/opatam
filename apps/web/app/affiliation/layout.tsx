'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@booking-app/firebase';
import {
  LayoutDashboard,
  LogOut,
  Handshake,
  Menu,
  X,
  BarChart3,
  ArrowLeftRight,
  UserCog,
} from 'lucide-react';

interface AffiliateUser {
  uid: string;
  email: string;
  displayName: string;
  affiliateId: string;
}

const NAV_ITEMS = [
  { href: '/affiliation/dashboard', label: 'Aperçu', icon: LayoutDashboard },
  { href: '/affiliation/statistiques', label: 'Statistiques', icon: BarChart3 },
  { href: '/affiliation/virements', label: 'Virements', icon: ArrowLeftRight },
  { href: '/affiliation/compte', label: 'Mon compte', icon: UserCog },
];

export default function AffiliationLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AffiliateUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setLoading(false);
        if (pathname !== '/affiliation/login') {
          router.replace('/affiliation/login');
        }
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const userData = userDoc.data();
        if (userData?.affiliateId) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: userData.displayName || '',
            affiliateId: userData.affiliateId,
          });
          if (pathname === '/affiliation/login') {
            router.replace('/affiliation/dashboard');
          }
        } else {
          setUser(null);
          if (pathname !== '/affiliation/login') {
            router.replace('/affiliation/login');
          }
        }
      } catch {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const handleLogout = async () => {
    await signOut(auth);
    router.replace('/affiliation/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Login page — no sidebar
  if (pathname === '/affiliation/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile topbar — only visible below lg */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
            <Handshake className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm">Opatam</span>
        </div>
        <div className="w-9" />
      </div>

      {/* Mobile backdrop — only when drawer is open */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — fixed on desktop, slide-in drawer on mobile */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200
          flex flex-col z-50 transition-transform duration-300
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Header (logo) */}
        <div className="flex items-center justify-between gap-3 px-5 h-16 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-gray-900 text-base">Opatam</span>
              <p className="text-[10px] text-gray-400 -mt-0.5">Espace affilié</p>
            </div>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-700 rounded"
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.displayName}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content — shifts right on desktop, full width on mobile */}
      <main className="min-h-screen lg:ml-64 pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
