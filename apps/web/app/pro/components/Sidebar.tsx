'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  List,
  Scissors,
  Users,
  MapPin,
  Clock,
  Star,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  requiresTeam?: boolean;
  comingSoon?: boolean;
}

const navItems: NavItem[] = [
  { label: 'Tableau de bord', href: '/pro', icon: <Home className="w-5 h-5" /> },
  { label: 'Calendrier', href: '/pro/calendrier', icon: <Calendar className="w-5 h-5" /> },
  { label: 'Reservations', href: '/pro/reservations', icon: <List className="w-5 h-5" /> },
  { label: 'Prestations', href: '/pro/prestations', icon: <Scissors className="w-5 h-5" /> },
  { label: 'Equipe', href: '/pro/equipe', icon: <Users className="w-5 h-5" />, requiresTeam: true },
  { label: 'Lieux', href: '/pro/lieux', icon: <MapPin className="w-5 h-5" /> },
  { label: 'Disponibilites', href: '/pro/disponibilites', icon: <Clock className="w-5 h-5" /> },
  { label: 'Avis', href: '/pro/avis', icon: <Star className="w-5 h-5" /> },
  { label: 'Messages', href: '/pro/messages', icon: <MessageSquare className="w-5 h-5" />, comingSoon: true },
  { label: 'Parametres', href: '/pro/parametres', icon: <Settings className="w-5 h-5" /> },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, provider, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const isTeamPlan = provider?.plan === 'team';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (href: string) => {
    if (href === '/pro') {
      return pathname === '/pro';
    }
    return pathname.startsWith(href);
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.requiresTeam && !isTeamPlan) return false;
    return true;
  });

  return (
    <aside
      className={`
        hidden lg:flex flex-col bg-gray-950 text-white
        sticky top-0 h-screen
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Logo */}
      <div className="p-4 border-b border-gray-800/50/50">
        <Link href="/pro" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold text-white">Opatam</h1>
              <p className="text-xs text-gray-400">Espace Pro</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.comingSoon ? '#' : item.href}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                  ${collapsed ? 'justify-center' : ''}
                  ${
                    isActive(item.href)
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                  ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={item.comingSoon ? (e) => e.preventDefault() : undefined}
                title={collapsed ? item.label : undefined}
              >
                {item.icon}
                {!collapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.comingSoon && (
                      <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                        Bientot
                      </span>
                    )}
                  </>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-800/50 p-4 space-y-4">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
            text-gray-400 hover:text-white hover:bg-gray-800
            ${collapsed ? 'justify-center' : ''}
          `}
          title={isDark ? 'Mode clair' : 'Mode sombre'}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          {!collapsed && <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>}
        </button>

        {/* User info */}
        <div
          className={`flex items-center gap-3 p-3 rounded-xl bg-gray-800 ${collapsed ? 'justify-center' : ''}`}
        >
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold">
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </span>
            )}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {provider?.businessName || user?.displayName || 'Utilisateur'}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          )}
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
            text-gray-400 hover:text-white hover:bg-gray-800
            ${collapsed ? 'justify-center' : ''}
          `}
          title="Se deconnecter"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Se deconnecter</span>}
        </button>
      </div>
    </aside>
  );
}

// Mobile sidebar (drawer)
interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, provider, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);

  const isTeamPlan = provider?.plan === 'team';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
      onClose();
    }
  };

  const isActive = (href: string) => {
    if (href === '/pro') {
      return pathname === '/pro';
    }
    return pathname.startsWith(href);
  };

  const filteredNavItems = navItems.filter((item) => {
    if (item.requiresTeam && !isTeamPlan) return false;
    return true;
  });

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}

      {/* Drawer */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-72 bg-gray-950 text-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
          <Link href="/pro" className="flex items-center gap-3" onClick={onClose}>
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Opatam</h1>
              <p className="text-xs text-gray-400">Espace Pro</p>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {filteredNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.comingSoon ? '#' : item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                    ${
                      isActive(item.href)
                        ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }
                    ${item.comingSoon ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                  onClick={(e) => {
                    if (item.comingSoon) {
                      e.preventDefault();
                    } else {
                      onClose();
                    }
                  }}
                >
                  {item.icon}
                  <span className="flex-1">{item.label}</span>
                  {item.comingSoon && (
                    <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                      Bientot
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-800/50 p-4 space-y-4">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-gray-800"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{isDark ? 'Mode clair' : 'Mode sombre'}</span>
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-800">
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold">
                  {user?.displayName?.charAt(0).toUpperCase() || 'U'}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {provider?.businessName || user?.displayName || 'Utilisateur'}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <LogOut className="w-5 h-5" />
            <span>Se deconnecter</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// Mobile header
interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { user, provider } = useAuth();

  return (
    <header className="lg:hidden h-16 bg-gray-950 text-white flex items-center justify-between px-4">
      {/* Menu button */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Logo */}
      <Link href="/pro" className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-white">Opatam</span>
      </Link>

      {/* User avatar */}
      <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <span className="text-white font-semibold">
            {(provider?.businessName || user?.displayName)?.charAt(0).toUpperCase() || 'U'}
          </span>
        )}
      </div>
    </header>
  );
}
