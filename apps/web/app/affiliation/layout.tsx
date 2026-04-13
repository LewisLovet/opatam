'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@booking-app/firebase';
import { LayoutDashboard, Link2, LogOut, Handshake } from 'lucide-react';

interface AffiliateUser {
  uid: string;
  email: string;
  displayName: string;
  affiliateId: string;
}

export default function AffiliationLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AffiliateUser | null>(null);
  const [loading, setLoading] = useState(true);

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

      // Check if user has affiliateId
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
          // Authenticated but not an affiliate
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

  // Dashboard with sidebar
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col z-20">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <Handshake className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-gray-900 text-base">Opatam</span>
            <p className="text-[10px] text-gray-400 -mt-0.5">Espace affilié</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <Link
            href="/affiliation/dashboard"
            className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
              pathname === '/affiliation/dashboard'
                ? 'bg-primary-50 text-primary-700 font-medium'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
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

      {/* Main content */}
      <main className="ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}
