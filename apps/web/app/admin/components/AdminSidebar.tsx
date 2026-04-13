'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Star,
  Euro,
  BarChart3,
  Activity,
  Handshake,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { LogoWhite } from '@/components/ui';
import { ChangeCodeModal } from './ChangeCodeModal';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard className="w-5 h-5" /> },
      { label: 'Utilisateurs', href: '/admin/users', icon: <Users className="w-5 h-5" /> },
      { label: 'Prestataires', href: '/admin/providers', icon: <Briefcase className="w-5 h-5" /> },
    ],
  },
  {
    label: 'Activité',
    items: [
      { label: 'Réservations', href: '/admin/bookings', icon: <Calendar className="w-5 h-5" /> },
      { label: 'Avis', href: '/admin/reviews', icon: <Star className="w-5 h-5" /> },
      { label: 'Revenue', href: '/admin/revenue', icon: <Euro className="w-5 h-5" /> },
      { label: 'Affiliés', href: '/admin/affiliates', icon: <Handshake className="w-5 h-5" /> },
    ],
  },
  {
    label: 'Analyse',
    items: [
      { label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 className="w-5 h-5" /> },
      { label: 'Activité', href: '/admin/activity', icon: <Activity className="w-5 h-5" /> },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AdminSidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showChangeCode, setShowChangeCode] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      sessionStorage.removeItem('adminSessionVerified');
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

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
      <div className="p-4 border-b border-gray-800/50">
        <Link href="/admin">
          <LogoWhite
            size="lg"
            variant="light"
            showText={!collapsed}
            subtitle={collapsed ? undefined : 'Administration'}
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-6">
          {navGroups.map((group, groupIndex) => (
            <ul key={groupIndex} className="space-y-1">
              {group.label && !collapsed && (
                <li className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {group.label}
                </li>
              )}
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                      ${collapsed ? 'justify-center' : ''}
                      ${
                        isActive(item.href)
                          ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                          : 'text-gray-400 hover:text-white hover:bg-gray-800'
                      }
                    `}
                    title={collapsed ? item.label : undefined}
                  >
                    {item.icon}
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-gray-800/50 p-4 space-y-4">
        {/* Admin badge */}
        <div
          className={`flex items-center gap-2 p-2 rounded-xl bg-red-500/10 ${collapsed ? 'justify-center' : ''}`}
        >
          <ShieldCheck className="w-4 h-4 text-red-400 flex-shrink-0" />
          {!collapsed && (
            <span className="text-xs font-semibold text-red-400">Admin</span>
          )}
        </div>

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
          <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="text-white font-semibold">
                {user?.displayName?.charAt(0).toUpperCase() || 'A'}
              </span>
            )}
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.displayName || 'Admin'}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          )}
        </div>

        {/* Change code button */}
        <button
          onClick={() => setShowChangeCode(true)}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
            text-gray-400 hover:text-white hover:bg-gray-800
            ${collapsed ? 'justify-center' : ''}
          `}
          title="Modifier le code"
        >
          <KeyRound className="w-5 h-5" />
          {!collapsed && <span>Modifier le code</span>}
        </button>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
            text-gray-400 hover:text-white hover:bg-gray-800
            ${collapsed ? 'justify-center' : ''}
          `}
          title="Se déconnecter"
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span>Se déconnecter</span>}
        </button>
      </div>

      <ChangeCodeModal open={showChangeCode} onClose={() => setShowChangeCode(false)} />
    </aside>
  );
}

// Mobile sidebar (drawer)
interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminMobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showChangeCode, setShowChangeCode] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      sessionStorage.removeItem('adminSessionVerified');
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
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}

      <aside
        className={`
          fixed inset-y-0 left-0 w-72 bg-gray-950 text-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
          <Link href="/admin" onClick={onClose}>
            <LogoWhite size="lg" variant="light" subtitle="Administration" />
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
          <div className="space-y-6">
            {navGroups.map((group, groupIndex) => (
              <ul key={groupIndex} className="space-y-1">
                {group.label && (
                  <li className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {group.label}
                  </li>
                )}
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                        ${
                          isActive(item.href)
                            ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800'
                        }
                      `}
                      onClick={onClose}
                    >
                      {item.icon}
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="border-t border-gray-800/50 p-4 space-y-4">
          {/* Admin badge */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-red-500/10">
            <ShieldCheck className="w-4 h-4 text-red-400" />
            <span className="text-xs font-semibold text-red-400">Admin</span>
          </div>

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
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center flex-shrink-0">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold">
                  {user?.displayName?.charAt(0).toUpperCase() || 'A'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user?.displayName || 'Admin'}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Change code button */}
          <button
            onClick={() => setShowChangeCode(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <KeyRound className="w-5 h-5" />
            <span>Modifier le code</span>
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <LogOut className="w-5 h-5" />
            <span>Se déconnecter</span>
          </button>
        </div>

        <ChangeCodeModal open={showChangeCode} onClose={() => setShowChangeCode(false)} />
      </aside>
    </>
  );
}

// Mobile header
interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function AdminMobileHeader({ onMenuClick }: MobileHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="lg:hidden h-16 bg-gray-950 text-white flex items-center justify-between px-4">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      <Link href="/admin">
        <LogoWhite size="md" variant="light" />
      </Link>

      <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <span className="text-white font-semibold">
            {user?.displayName?.charAt(0).toUpperCase() || 'A'}
          </span>
        )}
      </div>
    </header>
  );
}
