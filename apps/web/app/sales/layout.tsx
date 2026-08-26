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
  Menu,
  X,
} from 'lucide-react';
import { vueCommercialeActive, basculerVueCommerciale, enTetesStaff } from './entetes';

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
  // Prospects du pool en attente de prise en charge — badge sur « Pipeline » :
  // un prospect proposé à l'équipe qui dort, c'est un client perdu.
  const [poolCount, setPoolCount] = useState(0);
  useEffect(() => {
    if (!staff || staff === 'refuse') return;
    void (async () => {
      try {
        const res = await fetch('/api/sales/leads', { headers: await enTetesStaff() });
        if (!res.ok) return;
        const { leads } = await res.json();
        setPoolCount(
          Array.isArray(leads)
            ? leads.filter((l: { ownerUid: string | null }) => l.ownerUid === null).length
            : 0,
        );
      } catch {
        // badge silencieux
      }
    })();
  }, [staff]);
  // Rôle EFFECTIF côté interface : la vue commerciale doit cacher ce que le
  // serveur refuserait de toute façon (l'onglet Équipe en tête) — voir
  // l'onglet puis un refus donne l'impression d'un cloisonnement raté.
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
          {NAV.filter((n) => !('managerOnly' in n && n.managerOnly) || (staff.role === 'sales_manager' && !vueCommerciale)).map(({ label, href, icon: Icon, ready }) => {
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
                {href === '/sales/pipeline' && poolCount > 0 && (
                  <span
                    className="ml-auto min-w-[20px] text-center text-[11px] font-bold tabular-nums bg-blue-500 text-white rounded-full px-1.5 py-0.5"
                    title={`${poolCount} prospect${poolCount > 1 ? 's' : ''} à prendre en charge`}
                  >
                    {poolCount}
                  </span>
                )}
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
        {/* Barre mobile du haut : hamburger → tiroir latéral (même sidebar
            que desktop, en superposition). */}
        <div className="lg:hidden bg-gray-950 text-white px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setMenuMobile(true)}
            aria-label="Ouvrir le menu"
            className="p-1.5 -ml-1.5 rounded-lg active:bg-gray-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-sm font-bold">Opatam Sales</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">
            {vueCommerciale ? 'Vue com.' : staff.role === 'sales_manager' ? 'Manager' : 'Commercial'}
          </span>
        </div>

        {/* Tiroir mobile : la sidebar complète, en superposition */}
        {menuMobile && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={() => setMenuMobile(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-gray-950 text-white flex flex-col overflow-y-auto">
              <div className="flex items-center justify-between p-5 pb-2">
                <div>
                  <p className="text-lg font-bold">Opatam</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-red-400 mt-0.5">
                    Espace commercial
                  </p>
                </div>
                <button
                  onClick={() => setMenuMobile(false)}
                  aria-label="Fermer le menu"
                  className="p-1.5 rounded-lg text-gray-400 active:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* La bascule de vue, EN TÊTE — introuvable quand elle vivait
                  en pied de tiroir (retour client). */}
              {staff.role === 'sales_manager' && (
                <div className="px-3 pt-1">
                  <button
                    onClick={() => basculerVueCommerciale(!vueCommerciale)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold border ${
                      vueCommerciale
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                        : 'text-gray-200 border-gray-700 active:bg-gray-800'
                    }`}
                  >
                    <Eye className="w-5 h-5" />
                    {vueCommerciale ? 'Revenir à la vue manager' : 'Voir comme un commercial'}
                  </button>
                </div>
              )}
              <nav className="flex-1 min-h-0 px-3 py-4 space-y-1">
                {NAV.filter(
                  (n) => !('managerOnly' in n && n.managerOnly) || (staff.role === 'sales_manager' && !vueCommerciale),
                ).map(({ label, href, icon: Icon, ready }) => {
                  if (!ready) {
                    return (
                      <span
                        key={href}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-600 select-none"
                      >
                        <Icon className="w-5 h-5" />
                        <span>{label}</span>
                        <span className="text-[10px] uppercase tracking-wide text-gray-600 border border-gray-700 rounded-full px-1.5 py-0.5">
                          Bientôt
                        </span>
                      </span>
                    );
                  }
                  const actif = href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuMobile(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        actif
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                          : 'text-gray-400 active:text-white active:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                      {href === '/sales/pipeline' && poolCount > 0 && (
                        <span className="ml-auto min-w-[20px] text-center text-[11px] font-bold tabular-nums bg-blue-500 text-white rounded-full px-1.5 py-0.5">
                          {poolCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-gray-800/50 p-4 space-y-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {user?.isAdmin && (
                  <Link
                    href="/admin"
                    onClick={() => setMenuMobile(false)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 active:bg-gray-800"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Espace admin
                  </Link>
                )}
                <Link
                  href="/pro"
                  onClick={() => setMenuMobile(false)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 active:bg-gray-800"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Espace pro
                </Link>
                <div className="px-1 pt-1">
                  <p className="text-sm font-medium truncate">{staff.displayName}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => logout().then(() => router.push('/login'))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-400 active:bg-gray-800"
                >
                  <LogOut className="w-4 h-4" />
                  Se déconnecter
                </button>
              </div>
            </aside>
          </div>
        )}
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
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
