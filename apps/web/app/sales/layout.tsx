'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Loader } from '@/components/ui';
import {
  LayoutDashboard,
  Kanban,
  Presentation,
  BookOpen,
  Tag,
  ShieldCheck,
  LogOut,
} from 'lucide-react';

interface StaffInfo {
  role: 'sales' | 'sales_manager';
  displayName: string;
  active: boolean;
}

/** Menu de l'espace. Les modules pas encore construits restent visibles mais
 *  inertes : le commercial voit où l'outil va, sans liens morts. */
const NAV = [
  { label: 'Tableau de bord', href: '/sales', icon: LayoutDashboard, ready: true },
  { label: 'Pipeline', href: '/sales/pipeline', icon: Kanban, ready: true },
  { label: 'Démonstration', href: '/sales/demo', icon: Presentation, ready: true },
  { label: 'Bibliothèque', href: '/sales/bibliotheque', icon: BookOpen, ready: false },
  { label: 'Offres', href: '/sales/offres', icon: Tag, ready: false },
];

/**
 * Garde + coquille de l'espace commercial.
 *
 * Le rôle vit dans `staffMembers/{uid}` — seule lecture client autorisée par
 * les règles, et uniquement SA propre fiche. Un admin passe (il gère
 * l'équipe, il voit ce qu'elle voit). Toute donnée métier transite par les
 * routes serveur (`requireStaff`), jamais par le SDK.
 */
export default function SalesLayout({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<StaffInfo | null | 'refuse'>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/sales');
      return;
    }
    if (user.isAdmin) {
      setStaff({ role: 'sales_manager', displayName: user.displayName ?? 'Admin', active: true });
      return;
    }
    getDoc(doc(getFirestore(), 'staffMembers', user.id))
      .then((snap) => {
        const d = snap.data() as StaffInfo | undefined;
        if (snap.exists() && d?.active) setStaff(d);
        else setStaff('refuse');
      })
      .catch(() => setStaff('refuse'));
  }, [user, loading, router]);

  useEffect(() => {
    if (staff === 'refuse') router.replace('/');
  }, [staff, router]);

  if (loading || staff === null || staff === 'refuse') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      {/* ── Sidebar ── */}
      <aside className="hidden lg:flex w-64 flex-col bg-gray-950 text-white sticky top-0 h-screen">
        <div className="p-5 border-b border-gray-800/50">
          <p className="text-lg font-bold tracking-tight">Opatam</p>
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mt-0.5">
            Espace commercial
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV.map(({ label, href, icon: Icon, ready }) => {
            const actif = pathname === href;
            if (!ready) {
              return (
                <div
                  key={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 cursor-default select-none"
                  title="Bientôt disponible"
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{label}</span>
                  <span className="text-[10px] uppercase tracking-wide text-gray-600 border border-gray-700 rounded-full px-1.5 py-0.5">
                    bientôt
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  actif
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-800/50 p-4 space-y-3">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-red-500/10">
            <ShieldCheck className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-red-400">
              {staff.role === 'sales_manager' ? 'Manager' : 'Commercial'}
            </span>
          </div>
          <div className="px-1">
            <p className="text-sm font-medium truncate">{staff.displayName}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={() => logout().then(() => router.push('/login'))}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <div className="flex-1 min-w-0">
        {/* Barre mobile : le menu tient sur une ligne défilante */}
        <div className="lg:hidden bg-gray-950 text-white px-4 py-3 flex items-center gap-4 overflow-x-auto">
          <span className="text-sm font-bold whitespace-nowrap">Opatam Sales</span>
          {NAV.filter((n) => n.ready).map(({ label, href }) => (
            <Link key={href} href={href} className="text-sm text-gray-300 whitespace-nowrap">
              {label}
            </Link>
          ))}
        </div>
        <main className="p-6 lg:p-8 max-w-6xl">{children}</main>
      </div>
    </div>
  );
}
