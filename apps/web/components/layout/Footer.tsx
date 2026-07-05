'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
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

export function Footer({ variant = 'full' }: FooterProps) {
  const t = useTranslations('layout');
  const currentYear = new Date().getFullYear();

  // Built in-component so every label follows the active locale.
  const footerSections: FooterSection[] = [
    {
      title: t('footer.product'),
      links: [
        { href: '/#fonctionnalites', label: t('header.features') },
        { href: '/#tarifs', label: t('header.pricing') },
        { href: '/#temoignages', label: t('header.testimonials') },
        { href: '/#faq', label: t('header.faq') },
      ],
    },
    {
      title: t('footer.explore'),
      links: [
        { href: '/recherche', label: t('footer.allProviders') },
      ],
    },
    {
      title: t('footer.forWho'),
      links: [
        { href: '/nail-artist', label: t('footer.nailArtists') },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { href: '/contact', label: t('footer.contact') },
        { href: '/recrutement', label: t('footer.careers') },
        { href: '/telechargement', label: t('footer.downloadApp') },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { href: '/mentions-legales', label: t('footer.legalNotice') },
        { href: '/cgu', label: t('footer.terms') },
        { href: '/cgv', label: t('footer.salesTerms') },
        { href: '/confidentialite', label: t('footer.privacy') },
      ],
    },
  ];

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
                {t('footer.legalNotice')}
              </Link>
              <span className="hidden sm:inline">·</span>
              <Link href="/contact" className="hover:text-gray-900 dark:hover:text-white transition-colors">
                {t('footer.contact')}
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
              &copy; {currentYear} {APP_CONFIG.name}. {t('footer.allRights')}
            </span>
          </div>

          {/* Social Links */}
          <SocialLinks />
        </div>
      </div>
    </footer>
  );
}
