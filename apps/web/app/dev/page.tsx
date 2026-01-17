'use client';

import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';

const devSections = [
  {
    href: '/dev/components',
    title: 'UI Components',
    description: 'Showcase des composants UI de base (Button, Input, Card...)',
    color: 'bg-blue-500',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    href: '/dev/components-metier',
    title: 'Composants Métier',
    description: 'Header, SearchBar, ProviderCard, SlotPicker, etc.',
    color: 'bg-green-500',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: '/dev/tests',
    title: 'Tests Repositories',
    description: 'CRUD Firestore collections (Users, Providers, etc.)',
    color: 'bg-orange-500',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/services',
    title: 'Tests Services',
    description: 'Logique métier & workflows (Auth, Booking, Scheduling...)',
    color: 'bg-purple-500',
    icon: (
      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const quickLinks = [
  { href: '/dev/components-metier', label: 'Composants Métier', highlight: true },
  { href: '/dev/tests/services/auth', label: 'Auth' },
  { href: '/dev/tests/services/provider', label: 'Provider' },
  { href: '/dev/tests/services/members', label: 'Members' },
  { href: '/dev/tests/services/catalog', label: 'Catalog' },
  { href: '/dev/tests/services/scheduling', label: 'Scheduling' },
  { href: '/dev/tests/services/bookings', label: 'Bookings' },
  { href: '/dev/tests/firebase-connection', label: 'Firebase' },
];

const repoLinks = [
  { href: '/dev/tests/users', label: 'Users' },
  { href: '/dev/tests/providers', label: 'Providers' },
  { href: '/dev/tests/prestations', label: 'Prestations' },
  { href: '/dev/tests/availability', label: 'Availability' },
];

export default function DevHubPage() {
  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Dev Hub
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Outils de développement et pages de test pour le booking-app
          </p>
        </div>

        {/* Main Sections */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          {devSections.map((section) => (
            <Link key={section.href} href={section.href}>
              <Card className="h-full hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 ${section.color} rounded-xl text-white flex-shrink-0`}>
                      {section.icon}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {section.title}
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>

        {/* Quick Access */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Services Quick Links */}
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Accès rapide - Services
              </h3>
              <div className="flex flex-wrap gap-2">
                {quickLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      'highlight' in link && link.highlight
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                        : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Repositories Quick Links */}
          <Card>
            <CardBody>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
                Accès rapide - Repositories
              </h3>
              <div className="flex flex-wrap gap-2">
                {repoLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Info */}
        <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <span className="font-medium">Tip:</span> Utilisez la sidebar à gauche pour naviguer entre les différentes sections de développement.
            Ces pages sont uniquement accessibles en environnement de développement.
          </p>
        </div>
      </div>
    </div>
  );
}
