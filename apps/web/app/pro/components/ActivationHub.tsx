'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import type { Provider } from '@booking-app/shared';
import { Button } from '@/components/ui';

interface ActivationHubProps {
  provider: Provider;
  hasService: boolean;
  hasLocation: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  href: string;
  done: boolean;
  optional?: boolean;
  finale?: boolean;
}

export function ActivationHub({ provider, hasService, hasLocation }: ActivationHubProps) {
  const items: ChecklistItem[] = [
    {
      id: 'profile',
      label: 'Votre profil est créé',
      href: '/pro/profil?tab=profil',
      done: true,
    },
    {
      id: 'photo',
      label: 'Ajouter une photo de profil',
      href: '/pro/profil?tab=profil',
      done: !!provider.photoURL,
    },
    {
      id: 'portfolio',
      label: 'Ajouter des photos (portfolio)',
      href: '/pro/profil?tab=portfolio',
      done: (provider.portfolioPhotos?.length ?? 0) > 0,
    },
    {
      id: 'service',
      label: 'Créer une prestation',
      href: '/pro/activite?tab=prestations',
      done: hasService,
    },
    {
      id: 'location',
      label: 'Ajouter un lieu',
      href: '/pro/activite?tab=lieux',
      done: hasLocation,
    },
    {
      id: 'payments',
      label: 'Activer les paiements & acomptes (optionnel)',
      href: '/pro/parametres?tab=paiements',
      done: provider.stripeConnectStatus === 'active',
      optional: true,
    },
    {
      id: 'publish',
      label: 'Publier votre page',
      href: '/pro/profil?tab=publication',
      done: !!provider.isPublished,
      finale: true,
    },
  ];

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.done).length;
  const completion = Math.round((doneCount / totalCount) * 100);

  // Disappear once everything is done.
  if (doneCount === totalCount) return null;

  const isPublished = !!provider.isPublished;

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isPublished ? (
                <>Votre page est en ligne 🎉</>
              ) : (
                <>Votre page est prête à {completion}&nbsp;%</>
              )}
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {isPublished
                ? 'Quelques détails de plus pour tirer le meilleur de votre page.'
                : 'Finalisez votre page pour recevoir vos premières réservations.'}
            </p>
          </div>
          <span className="text-2xl font-bold text-primary-600 dark:text-primary-400 flex-shrink-0">
            {completion}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-500"
            style={{ width: `${completion}%` }}
          />
        </div>

        {/* Checklist */}
        <ul className="mt-5 space-y-1">
          {items.map((item) => {
            const isFinaleCta = item.finale && !item.done;

            if (isFinaleCta) {
              return (
                <li
                  key={item.id}
                  className="mt-3 pt-4 border-t border-gray-100 dark:border-gray-700"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {item.label}
                      </span>
                    </div>
                    <Link href={item.href} className="sm:flex-shrink-0">
                      <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                        Publier ma page
                      </Button>
                    </Link>
                  </div>
                </li>
              );
            }

            return (
              <li key={item.id}>
                {item.done ? (
                  <div className="flex items-center gap-3 py-2">
                    <CheckCircle2 className="w-5 h-5 text-success-500 dark:text-success-400 flex-shrink-0" />
                    <span className="text-sm text-gray-500 dark:text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 py-2 rounded-lg transition-colors"
                  >
                    <Circle className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 group-hover:gap-1.5 transition-all flex-shrink-0">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
