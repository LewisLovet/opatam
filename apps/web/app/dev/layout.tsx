'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Home,
  Package,
  Blocks,
  Database,
  Settings,
  CreditCard,
  Zap,
  Sprout,
  ArrowLeft,
  Code2,
  Menu,
  X,
  Lock,
  ChevronDown,
  Flame,
  Terminal,
  Sparkles,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

const navSections: { title: string; items: NavItem[] }[] = [
  {
    title: '',
    items: [
      {
        href: '/dev',
        label: 'Accueil',
        icon: <Home className="w-4 h-4" />,
      },
    ],
  },
  {
    title: 'Composants',
    items: [
      {
        href: '/dev/components',
        label: 'UI Components',
        icon: <Package className="w-4 h-4" />,
      },
      {
        href: '/dev/components-metier',
        label: 'Composants Metier',
        icon: <Blocks className="w-4 h-4" />,
      },
    ],
  },
  {
    title: 'Tests',
    items: [
      {
        href: '/dev/tests/firebase-connection',
        label: 'Firebase Connection',
        icon: <Flame className="w-4 h-4" />,
      },
      {
        href: '/dev/tests',
        label: 'Repositories',
        icon: <Database className="w-4 h-4" />,
        children: [
          { href: '/dev/tests/users', label: 'Users', icon: <></> },
          { href: '/dev/tests/providers', label: 'Providers', icon: <></> },
          { href: '/dev/tests/members', label: 'Members', icon: <></> },
          { href: '/dev/tests/locations', label: 'Locations', icon: <></> },
          { href: '/dev/tests/prestations', label: 'Prestations', icon: <></> },
          { href: '/dev/tests/availability', label: 'Availability', icon: <></> },
          { href: '/dev/tests/bookings', label: 'Bookings', icon: <></> },
        ],
      },
      {
        href: '/dev/tests/services',
        label: 'Services',
        icon: <Settings className="w-4 h-4" />,
        children: [
          { href: '/dev/tests/services/auth', label: 'Auth', icon: <></> },
          { href: '/dev/tests/services/provider', label: 'Provider', icon: <></> },
          { href: '/dev/tests/services/members', label: 'Members', icon: <></> },
          { href: '/dev/tests/services/catalog', label: 'Catalog', icon: <></> },
          { href: '/dev/tests/services/scheduling', label: 'Scheduling', icon: <></> },
          { href: '/dev/tests/services/bookings', label: 'Bookings', icon: <></> },
        ],
      },
      {
        href: '/dev/tests/stripe',
        label: 'Stripe',
        icon: <CreditCard className="w-4 h-4" />,
      },
    ],
  },
  {
    title: 'Outils',
    items: [
      {
        href: '/dev/tools/functions',
        label: 'Cloud Functions',
        icon: <Zap className="w-4 h-4" />,
      },
      {
        href: '/dev/tools/seed',
        label: 'Donnees de test',
        icon: <Sprout className="w-4 h-4" />,
      },
    ],
  },
];

function NavLink({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const pathname = usePathname();
  const hasChildren = item.children && item.children.length > 0;

  const isExactActive = pathname === item.href;
  const isChildActive = item.children?.some(
    (child) => pathname === child.href || pathname.startsWith(child.href + '/')
  );
  const isActive = isExactActive || isChildActive;

  const [isOpen, setIsOpen] = useState(isActive || false);

  // Keep expanded if a child becomes active (e.g. from navigation)
  useEffect(() => {
    if (isChildActive) {
      setIsOpen(true);
    }
  }, [isChildActive]);

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`
            group w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg transition-all duration-200
            ${isActive
              ? 'bg-gradient-to-r from-purple-500/15 to-pink-500/10 text-purple-300 dark:text-purple-300 shadow-[inset_0_1px_0_rgba(168,85,247,0.2)]'
              : 'text-slate-400 dark:text-slate-400 hover:bg-white/5 dark:hover:bg-white/5 hover:text-slate-200 dark:hover:text-slate-200'
            }
          `}
        >
          <div className="flex items-center gap-2.5">
            <span className={`transition-colors duration-200 ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
        {isOpen && item.children && (
          <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-700/50 dark:border-slate-700/50 pl-2">
            {item.children.map((child) => (
              <NavLink key={child.href} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`
        group flex items-center gap-2.5 px-3 text-sm rounded-lg transition-all duration-200
        ${depth > 0 ? 'py-1.5' : 'py-2'}
        ${isExactActive
          ? 'bg-gradient-to-r from-purple-500/15 to-pink-500/10 text-white dark:text-white font-medium shadow-[inset_0_1px_0_rgba(168,85,247,0.2)]'
          : 'text-slate-400 dark:text-slate-400 hover:bg-white/5 dark:hover:bg-white/5 hover:text-slate-200 dark:hover:text-slate-200'
        }
      `}
    >
      {depth === 0 && (
        <span className={`transition-colors duration-200 ${isExactActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
          {item.icon}
        </span>
      )}
      {depth > 0 && (
        <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${isExactActive ? 'bg-purple-400' : 'bg-slate-600 group-hover:bg-slate-400'}`} />
      )}
      <span>{item.label}</span>
    </Link>
  );
}

export default function DevLayout({ children }: { children: React.ReactNode }) {
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Force dark background on body for dev pages (overrides globals.css --background: #ffffff)
  useEffect(() => {
    const prev = document.body.style.background;
    document.body.style.background = '#020617'; // slate-950
    return () => {
      document.body.style.background = prev;
    };
  }, []);

  // Production guard
  useEffect(() => {
    const hostname = window.location.hostname;
    const isDev =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('vercel.app') ||
      hostname.includes('local');
    setIsAllowed(isDev);
  }, []);

  // Loading state
  if (isAllowed === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Chargement...</span>
        </div>
      </div>
    );
  }

  // Blocked in production
  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-800/80 rounded-2xl flex items-center justify-center border border-slate-700/50 shadow-lg shadow-slate-900/50">
            <Lock className="w-8 h-8 text-slate-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Acces non autorise
          </h1>
          <p className="text-slate-400">
            Cette page n&apos;est disponible qu&apos;en environnement de developpement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 dark:bg-slate-950">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-40 bg-slate-900/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50">
        <div className="flex items-center justify-between px-4 h-14">
          <Link href="/dev" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-white">Dev Hub</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-800/50 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-30 w-64
            bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
            dark:bg-gradient-to-b dark:from-slate-900 dark:via-slate-900 dark:to-slate-950
            border-r border-slate-800/50
            transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-auto
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            flex flex-col
          `}
        >
          {/* Logo (Desktop) */}
          <div className="hidden lg:flex items-center gap-3 px-5 h-16 border-b border-slate-800/50">
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Code2 className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900" />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight">Dev Hub</span>
              <p className="text-[10px] text-slate-500 -mt-0.5 font-medium">Opatam Platform</p>
            </div>
          </div>

          {/* Dev Mode Badge */}
          <div className="px-4 py-3">
            <div className="relative overflow-hidden px-3 py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 text-amber-400/90 text-xs font-semibold rounded-lg text-center">
              <Sparkles className="w-3 h-3 inline-block mr-1.5 -mt-0.5" />
              Mode Developpement
              <div className="absolute top-0 right-0 w-2 h-2 bg-amber-400 rounded-full m-1.5 animate-pulse" />
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 pb-4 space-y-5 overflow-y-auto">
            {navSections.map((section, sectionIndex) => (
              <div key={sectionIndex}>
                {section.title && (
                  <div className="flex items-center gap-2 px-3 mb-2">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-widest">
                      {section.title}
                    </p>
                    <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent" />
                  </div>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink key={item.href + item.label} item={item} />
                  ))}
                </div>
              </div>
            ))}

            {/* Back to App */}
            <div className="pt-4 mt-4 border-t border-slate-800/50">
              <Link
                href="/"
                className="group flex items-center gap-2.5 px-3 py-2 text-sm text-slate-500 hover:text-slate-300 rounded-lg hover:bg-white/5 transition-all duration-200"
              >
                <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
                <span>Retour a l&apos;app</span>
              </Link>
            </div>
          </nav>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-slate-800/50 bg-slate-950/50">
            <div className="flex items-center gap-2.5 text-[11px] text-slate-600">
              <Terminal className="w-3.5 h-3.5" />
              <span>v0.1.0-dev</span>
              <span className="text-slate-800">|</span>
              <span>Next.js 15</span>
            </div>
          </div>
        </aside>

        {/* Backdrop (Mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen lg:min-h-[calc(100vh)] overflow-x-hidden min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
