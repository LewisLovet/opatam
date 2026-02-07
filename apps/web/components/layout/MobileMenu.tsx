'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

interface NavLink {
  href: string;
  label: string;
}

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  navLinks: NavLink[];
  showAuthButtons?: boolean;
}

export function MobileMenu({ isOpen, onClose, navLinks, showAuthButtons = true }: MobileMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-gray-950/30 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel - slides from right with a rounded left edge */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 w-full max-w-[320px] bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl shadow-[-8px_0_30px_rgba(0,0,0,0.08)] animate-[slideIn_0.3s_ease-out]"
      >
        {/* Top accent line matching header */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary-500/60 to-transparent" />

        <div className="flex flex-col h-full">
          {/* Header with close button */}
          <div className="flex items-center justify-between px-5 h-[72px]">
            <span className="text-sm font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Menu
            </span>
            <button
              type="button"
              className="p-2.5 rounded-full text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100/80 dark:bg-gray-800/60 hover:bg-gray-200/80 dark:hover:bg-gray-700/60 border border-gray-200/50 dark:border-gray-700/40 transition-all duration-200"
              onClick={onClose}
              aria-label="Fermer le menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-5 py-4 overflow-y-auto">
            <div className="space-y-1">
              {navLinks.map((link, index) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="
                    group flex items-center gap-3 px-4 py-3.5 rounded-2xl
                    text-[15px] font-medium text-gray-700 dark:text-gray-300
                    hover:text-gray-900 dark:hover:text-white
                    hover:bg-gray-100/80 dark:hover:bg-gray-800/60
                    transition-all duration-200
                  "
                  onClick={onClose}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Active indicator dot */}
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500/0 group-hover:bg-primary-500 transition-colors duration-200" />
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Auth Buttons */}
          {showAuthButtons && (
            <div className="px-5 py-6 space-y-3">
              {/* Separator */}
              <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent mb-4" />

              <Link
                href="/login"
                onClick={onClose}
                className="
                  block w-full px-4 py-3 text-center text-sm font-medium
                  text-gray-700 dark:text-gray-300
                  bg-gray-100/80 dark:bg-gray-800/60
                  hover:bg-gray-200/80 dark:hover:bg-gray-700/60
                  border border-gray-200/50 dark:border-gray-700/40
                  rounded-full transition-all duration-200
                "
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="
                  relative block w-full px-4 py-3 text-center text-sm font-semibold
                  text-white rounded-full overflow-hidden
                  bg-gradient-to-b from-primary-500 to-primary-600
                  shadow-[0_2px_8px_var(--color-primary-600)/25]
                  active:shadow-[0_1px_4px_var(--color-primary-600)/20]
                  transition-all duration-200
                "
              >
                <span className="relative z-10">Commencer</span>
                {/* Inner highlight */}
                <div className="absolute inset-x-0 top-0 h-px bg-white/25 rounded-full" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
