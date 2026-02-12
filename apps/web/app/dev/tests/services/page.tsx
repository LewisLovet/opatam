'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';

const serviceTests = [
  {
    href: '/dev/tests/services/auth',
    title: 'Auth Service',
    description: 'Test inscription client/provider, connexion email, déconnexion, reset password',
    tests: ['registerClient', 'registerProvider', 'login', 'logout', 'resetPassword'],
  },
  {
    href: '/dev/tests/services/provider',
    title: 'Provider Service',
    description: 'Test création/modification provider, publication, génération de slug unique',
    tests: ['createProvider', 'updateProvider', 'publishProvider', 'checkPublishRequirements', 'generateSlug'],
  },
  {
    href: '/dev/tests/services/members',
    title: 'Members Service',
    description: 'Test création membre avec code accès, suppression avec vérification réservations',
    tests: ['createMember', 'generateAccessCode', 'deleteMember (check bookings)'],
  },
  {
    href: '/dev/tests/services/catalog',
    title: 'Catalog Service (Prestations)',
    description: 'Test création/modification prestations, duplication, filtrage par lieu/membre/prix',
    tests: ['createService', 'updateService', 'duplicateService', 'deactivate', 'filterByLocation', 'filterByMember'],
  },
  {
    href: '/dev/tests/services/scheduling',
    title: 'Scheduling Service',
    description: 'Test disponibilités, blocages, calcul créneaux disponibles',
    tests: ['setAvailability', 'setWeeklySchedule', 'blockPeriod', 'getAvailableSlots', 'isSlotAvailable'],
  },
  {
    href: '/dev/tests/services/bookings',
    title: 'Bookings Service',
    description: 'Test création réservation avec vérification dispo, confirmation, annulation',
    tests: ['createBooking', 'confirmBooking', 'cancelBooking', 'cancelByToken', 'completeBooking'],
  },
];

export default function ServicesTestIndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test des Services (Business Logic)
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Ces pages testent la couche service qui encapsule la logique métier,
          la validation Zod et les opérations multi-repositories.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {serviceTests.map((test) => (
          <Link key={test.href} href={test.href}>
            <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader title={test.title} />
              <CardBody>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  {test.description}
                </p>
                <div className="flex flex-wrap gap-1">
                  {test.tests.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>

      <Card variant="bordered" className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950">
        <CardBody>
          <p className="text-amber-800 dark:text-amber-200 text-sm">
            <strong>Note:</strong> Les services utilisent la validation Zod et peuvent rejeter
            des données invalides. Consultez les schémas dans <code>@booking-app/shared</code>
            pour connaître les formats attendus.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
