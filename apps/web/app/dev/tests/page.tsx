'use client';

import Link from 'next/link';
import { Card, CardBody } from '@/components/ui';

const repositoryTests = [
  {
    href: '/dev/tests/firebase-connection',
    title: 'Firebase Connection',
    description: 'Test de la connexion Firebase et configuration',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/users',
    title: 'Users Repository',
    description: 'CRUD operations sur la collection users',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/providers',
    title: 'Providers Repository',
    description: 'CRUD operations sur la collection providers',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/members',
    title: 'Members Repository',
    description: 'CRUD sur la sous-collection providers/{id}/members',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/locations',
    title: 'Locations Repository',
    description: 'CRUD sur la sous-collection providers/{id}/locations',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/prestations',
    title: 'Prestations Repository',
    description: 'CRUD sur la sous-collection providers/{id}/services',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/availability',
    title: 'Availability Repository',
    description: 'Test des disponibilités et créneaux bloqués',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/dev/tests/bookings',
    title: 'Bookings Repository',
    description: 'CRUD operations sur la collection bookings',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

const serviceTests = [
  {
    href: '/dev/tests/services',
    title: 'Services (Business Logic)',
    description: 'Test des services metier: auth, provider, scheduling, bookings',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function TestsIndexPage() {
  return (
    <div className="space-y-10">
      {/* Repositories Section */}
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Tests des Repositories
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Pages de test pour verifier le fonctionnement des repositories Firestore.
            Chaque page permet de tester les operations CRUD.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repositoryTests.map((test) => (
            <Link key={test.href} href={test.href}>
              <Card className="h-full hover:border-primary-500 transition-colors cursor-pointer">
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg text-primary-600 dark:text-primary-400">
                      {test.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {test.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {test.description}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Services Section */}
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Tests des Services
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Pages de test pour valider la logique metier encapsulee dans les services.
            Validation Zod, workflows multi-repositories, regles metier.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serviceTests.map((test) => (
            <Link key={test.href} href={test.href}>
              <Card className="h-full hover:border-primary-500 transition-colors cursor-pointer border-2 border-dashed border-primary-200 dark:border-primary-800">
                <CardBody>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg text-primary-600 dark:text-primary-400">
                      {test.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {test.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {test.description}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
