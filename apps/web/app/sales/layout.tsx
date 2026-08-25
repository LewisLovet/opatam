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
  Eye,
  ArrowLeftRight,
  Users,
} from 'lucide-react';
import { vueCommercialeActive, basculerVueCommerciale } from './entetes';

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
  { label: 'Bibliothèque', href: '/sales/bibliotheque', icon: BookOpen, ready: true },
  { label: 'Offres', href: '/sales/offres', icon: Tag, ready: true },
  // Réservé manager/admin — filtré au rendu selon le rôle.
  { label: 'Équipe', href: '/sales/equipe', icon: Users, ready: true, managerOnly: true },
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
  // Vue commerciale : lue après montage (localStorage n'existe pas au SSR).
  const [vueCommerciale, setVueCommerciale] = useState(false);
  const [menuMobile, setMenuMobile] = useState(false);
  useEffect(() => {
    setVueCommerciale(vueCommercialeActive());
  }, []);

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
          {NAV.filter((n) => !('managerOnly' in n && n.managerOnly) || staff.role === 'sales_manager').map(({ label, href, icon: Icon, ready }) => {
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
              {vueCommerciale ? 'Vue commerciale' : staff.role === 'sales_manager' ? 'Manager' : 'Commercial'}
            </span>
          </div>
          {/* Un manager voit tout ; ce bouton lui montre l'espace comme un
              commercial le voit — restriction appliquée CÔTÉ SERVEUR. */}
          {staff.role === 'sales_manager' && (
            <button
              onClick={() => basculerVueCommerciale(!vueCommerciale)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                vueCommerciale
                  ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Eye className="w-4 h-4" />
              {vueCommerciale ? 'Revenir à la vue manager' : 'Voir comme un commercial'}
            </button>
          )}
          {user?.isAdmin && (
            <Link
              href="/admin"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <ArrowLeftRight className="w-4 h-4" />
              Espace admin
            </Link>
          )}
          <Link
            href="/pro"
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Espace pro
          </Link>
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
        {/* Barre mobile du haut : identité + rôle. Le badge de rôle OUVRE le
            menu (vue commerciale, changement d'espace, déconnexion) — sur
            mobile, la sidebar n'existe pas, ces gestes doivent vivre ici. */}
        <div className="lg:hidden bg-gray-950 text-white">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold">Opatam Sales</span>
            <button
              onClick={() => setMenuMobile((m) => !m)}
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-400 bg-red-500/10 rounded-full px-2.5 py-1.5"
            >
              {vueCommerciale ? 'Vue commerciale' : staff.role === 'sales_manager' ? 'Manager' : 'Commercial'}
              <span className={`transition-transform ${menuMobile ? 'rotate-180' : ''}`}>▾</span>
            </button>
          </div>
          {menuMobile && (
            <div className="px-4 pb-3 space-y-1 border-t border-gray-800/60 pt-2">
              {staff.role === 'sales_manager' && (
                <button
                  onClick={() => basculerVueCommerciale(!vueCommerciale)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm ${
                    vueCommerciale ? 'bg-amber-500/15 text-amber-400' : 'text-gray-300 active:bg-gray-800'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  {vueCommerciale ? 'Revenir à la vue manager' : 'Voir comme un commercial'}
                </button>
              )}
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuMobile(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 active:bg-gray-800"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Espace admin
                </Link>
              )}
              <Link
                href="/pro"
                onClick={() => setMenuMobile(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-300 active:bg-gray-800"
              >
                <ArrowLeftRight className="w-4 h-4" />
                Espace pro
              </Link>
              <button
                onClick={() => logout().then(() => router.push('/login'))}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 active:bg-gray-800"
              >
                <LogOut className="w-4 h-4" />
                Se déconnecter
              </button>
            </div>
          )}
        </div>
        {vueCommerciale && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-amber-800 dark:text-amber-300">
              <Eye className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
              <strong>Vue commerciale</strong> — vous voyez l&apos;espace comme un commercial :
              uniquement vos propres démos, prospects et conversions.
            </p>
            <button
              onClick={() => basculerVueCommerciale(false)}
              className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline whitespace-nowrap"
            >
              Quitter
            </button>
          </div>
        )}
        <main className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">{children}</main>
        {/* Navigation mobile : barre d'onglets fixe en bas — le geste natif
            du téléphone, à la place de l'ancien bandeau défilant. */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-gray-950/95 backdrop-blur border-t border-gray-800 pb-[env(safe-area-inset-bottom)]">
          <div className="flex">
            {NAV.filter(
              (n) => n.ready && (!('managerOnly' in n && n.managerOnly) || staff.role === 'sales_manager'),
            ).map(({ label, href, icon: Icon }) => {
              const actif = href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex-1 flex flex-col items-center gap-0.5 pt-2.5 pb-2 transition-colors ${
                    actif ? 'text-red-400' : 'text-gray-500 active:text-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[9.5px] font-medium leading-none">
                    {label === 'Tableau de bord' ? 'Accueil' : label === 'Démonstration' ? 'Démos' : label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
