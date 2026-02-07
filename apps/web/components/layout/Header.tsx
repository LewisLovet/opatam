'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { MobileMenu } from './MobileMenu';
import { Logo } from '@/components/ui';

interface NavLink {
  href: string;
  label: string;
}

interface HeaderProps {
  showAuthButtons?: boolean;
  transparent?: boolean;
  navLinks?: NavLink[];
}

const defaultNavLinks: NavLink[] = [
  { href: '/#fonctionnalites', label: 'Fonctionnalites' },
  { href: '/#tarifs', label: 'Tarifs' },
  { href: '/#temoignages', label: 'Temoignages' },
  { href: '/#faq', label: 'FAQ' },
];

export function Header({
  showAuthButtons = true,
  transparent = false,
  navLinks = defaultNavLinks,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeLink, setActiveLink] = useState('');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    // Track which section is in view for the active indicator
    const handleIntersection = () => {
      const sections = navLinks.map((link) => link.href.replace('/#', ''));
      for (const id of sections.reverse()) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            setActiveLink(`/#${id}`);
            return;
          }
        }
      }
      setActiveLink('');
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleIntersection, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleIntersection);
    };
  }, [navLinks]);

  // Header outer background: fully transparent when at top + transparent mode,
  // otherwise a glass-morphism floating bar effect
  const headerBg = transparent
    ? scrolled
      ? 'bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
      : 'bg-transparent'
    : scrolled
      ? 'bg-white/70 dark:bg-gray-950/70 backdrop-blur-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
      : 'bg-white dark:bg-gray-950';

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-500 ease-out ${headerBg}`}
      >
        {/* Subtle top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary-500/60 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[72px]">
            {/* Logo with hover lift */}
            <Link
              href="/"
              className="relative group flex items-center transition-transform duration-200 hover:-translate-y-[1px]"
            >
              <Logo size="md" />
              {/* Subtle glow behind logo on hover */}
              <div className="absolute -inset-2 rounded-xl bg-primary-500/0 group-hover:bg-primary-500/[0.04] transition-colors duration-300 -z-10" />
            </Link>

            {/* Desktop Navigation - Pill container */}
            <nav className="hidden md:flex items-center">
              <div className="flex items-center gap-1 bg-gray-100/80 dark:bg-gray-800/60 backdrop-blur-sm rounded-full px-1.5 py-1.5 border border-gray-200/50 dark:border-gray-700/40">
                {navLinks.map((link) => {
                  const isActive = activeLink === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`
                        relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200
                        ${
                          isActive
                            ? 'text-primary-700 dark:text-primary-300 bg-white dark:bg-gray-800 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-gray-700/40'
                        }
                      `}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </nav>

            {/* Auth Buttons */}
            <div className="hidden md:flex items-center gap-3">
              {showAuthButtons && (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full transition-colors duration-200"
                  >
                    Se connecter
                  </Link>
                  <Link
                    href="/register"
                    className="
                      relative px-5 py-2 text-sm font-semibold text-white rounded-full
                      bg-gradient-to-b from-primary-500 to-primary-600
                      hover:from-primary-400 hover:to-primary-600
                      shadow-[0_1px_2px_rgba(0,0,0,0.1),0_4px_12px_var(--color-primary-600)/20]
                      hover:shadow-[0_1px_2px_rgba(0,0,0,0.1),0_6px_20px_var(--color-primary-600)/30]
                      transition-all duration-200 hover:-translate-y-[1px]
                      active:translate-y-0 active:shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_6px_var(--color-primary-600)/20]
                    "
                  >
                    <span className="relative z-10">Essai gratuit</span>
                    {/* Inner highlight */}
                    <div className="absolute inset-x-0 top-0 h-px bg-white/25 rounded-full" />
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button - Distinctive hamburger */}
            <button
              type="button"
              className="md:hidden relative p-2.5 rounded-full text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100/80 dark:bg-gray-800/60 hover:bg-gray-200/80 dark:hover:bg-gray-700/60 border border-gray-200/50 dark:border-gray-700/40 transition-all duration-200"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h10" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        navLinks={navLinks}
        showAuthButtons={showAuthButtons}
      />
    </>
  );
}
