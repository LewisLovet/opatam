'use client';

import Link from 'next/link';
import { AppStoreBadges } from '../common/AppStoreBadges';
import { Logo } from '@/components/ui';
import { APP_CONFIG } from '@booking-app/shared/constants';

interface FooterProps {
  variant?: 'full' | 'simple';
}

interface FooterLink {
  href: string;
  label: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerSections: FooterSection[] = [
  {
    title: 'Produit',
    links: [
      { href: '/#fonctionnalites', label: 'Fonctionnalités' },
      { href: '/#tarifs', label: 'Tarifs' },
      { href: '/#temoignages', label: 'Témoignages' },
      { href: '/#faq', label: 'FAQ' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '/contact', label: 'Contact' },
      { href: '/telechargement', label: 'Télécharger l\'app' },
    ],
  },
  {
    title: 'Légal',
    links: [
      { href: '/mentions-legales', label: 'Mentions légales' },
      { href: '/cgu', label: 'CGU' },
      { href: '/cgv', label: 'CGV' },
      { href: '/confidentialite', label: 'Confidentialité' },
    ],
  },
];

export function Footer({ variant = 'full' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  // Simple footer for landing page
  if (variant === 'simple') {
    return (
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Copyright & Links */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
              <span>&copy; {currentYear} Opatam</span>
              <span className="hidden sm:inline">·</span>
              <Link href="/mentions-legales" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Mentions legales
              </Link>
              <span className="hidden sm:inline">·</span>
              <Link href="/contact" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                Contact
              </Link>
            </div>

            {/* App Store Badges */}
            <AppStoreBadges size="sm" />
          </div>
        </div>
      </footer>
    );
  }

  // Full footer
  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-12">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo & Copyright */}
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              &copy; {currentYear} {APP_CONFIG.name}. Tous droits reserves.
            </span>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-4">
            <a
              href="https://www.instagram.com/opatam_app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Instagram"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
            <a
              href="https://www.tiktok.com/@opatam"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="TikTok"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.86a8.28 8.28 0 0 0 4.76 1.5v-3.4a4.85 4.85 0 0 1-1-.27z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
