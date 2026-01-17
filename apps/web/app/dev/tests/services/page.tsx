'use client';

import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui';

const serviceTests = [
  {
    href: '/dev/tests/services/auth',
    title: 'Auth Service',
    description: 'Test inscription client/provider, connexion email/Google, deconnexion, reset password',
    tests: ['registerClient', 'registerProvider', 'login', 'loginWithGoogle', 'logout', 'resetPassword'],
  },
  {
    href: '/dev/tests/services/provider',
    title: 'Provider Service',
    description: 'Test creation/modification provider, publication, generation de slug unique',
    tests: ['createProvider', 'updateProvider', 'publishProvider', 'checkPublishRequirements', 'generateSlug'],
  },
  {
    href: '/dev/tests/services/members',
    title: 'Members Service',
    description: 'Test creation membre avec code acces, suppression avec verification reservations',
    tests: ['createMember', 'generateAccessCode', 'deleteMember (check bookings)'],
  },
  {
    href: '/dev/tests/services/catalog',
    title: 'Catalog Service (Prestations)',
    description: 'Test creation/modification prestations, duplication, filtrage par lieu/membre/prix',
    tests: ['createService', 'updateService', 'duplicateService', 'deactivate', 'filterByLocation', 'filterByMember'],
  },
  {
    href: '/dev/tests/services/scheduling',
    title: 'Scheduling Service',
    description: 'Test disponibilites, blocages, calcul creneaux disponibles',
    tests: ['setAvailability', 'setWeeklySchedule', 'blockPeriod', 'getAvailableSlots', 'isSlotAvailable'],
  },
  {
    href: '/dev/tests/services/bookings',
    title: 'Bookings Service',
    description: 'Test creation reservation avec verification dispo, confirmation, annulation',
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
          Ces pages testent la couche service qui encapsule la logique metier,
          la validation Zod et les operations multi-repositories.
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
            des donnees invalides. Consultez les schemas dans <code>@booking-app/shared</code>
            pour connaitre les formats attendus.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
