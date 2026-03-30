'use client';

import Link from 'next/link';
import { AppStoreBadges } from '../common/AppStoreBadges';
import { SocialLinks } from '../common/SocialLinks';
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
      { href: '/recrutement', label: 'Recrutement' },
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

            {/* Social + App Store */}
            <div className="flex items-center gap-5">
              <SocialLinks size="sm" />
              <AppStoreBadges size="sm" />
            </div>
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
          <SocialLinks />
        </div>
      </div>
    </footer>
  );
}
