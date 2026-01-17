'use client';

import Link from 'next/link';
import { useEffect } from 'react';

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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200 dark:border-gray-800">
            <span className="text-lg font-semibold text-gray-900 dark:text-white">Menu</span>
            <button
              type="button"
              className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800"
              onClick={onClose}
              aria-label="Fermer le menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block px-4 py-3 rounded-lg text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
                onClick={onClose}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Auth Buttons */}
          {showAuthButtons && (
            <div className="px-4 py-6 border-t border-gray-200 dark:border-gray-800 space-y-3">
              <Link
                href="/login"
                onClick={onClose}
                className="block w-full px-4 py-2 text-center text-sm font-medium border-2 border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Se connecter
              </Link>
              <Link
                href="/register"
                onClick={onClose}
                className="block w-full px-4 py-2 text-center text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition-colors"
              >
                Commencer
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
