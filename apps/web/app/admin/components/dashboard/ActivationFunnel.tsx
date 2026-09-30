'use client';

import { ChevronRight, Rocket } from 'lucide-react';
import type { AdminOverview } from '@/services/admin/types';
import { Panel, PanelTitle } from './primitives';

/**
 * Ce que deviennent les prestataires inscrits ces 30 derniers jours : où
 * ils décrochent entre l'inscription et le premier paiement.
 */
export function ActivationFunnel({ activation }: { activation: AdminOverview['activation'] }) {
  const etapes = [
    { label: 'Inscrits', value: activation.signedUp, couleur: 'bg-violet-500' },
    { label: 'Page publiée', value: activation.published, couleur: 'bg-violet-400' },
    { label: '1ʳᵉ réservation', value: activation.firstBooking, couleur: 'bg-sky-400' },
    { label: 'Payants', value: activation.paying, couleur: 'bg-emerald-500' },
  ];
  const base = Math.max(1, activation.signedUp);
  return (
    <Panel>
      <PanelTitle
        icon={<Rocket className="h-4 w-4" />}
        accent="violet"
        title="Activation des nouveaux pros"
        right={<span className="text-xs text-gray-400">inscrits en 30 j</span>}
      />
      <div className="space-y-3 px-5 pb-5">
        {etapes.map((e, i) => {
          const precedent = i > 0 ? etapes[i - 1].value : null;
          const taux = precedent && precedent > 0 ? Math.round((e.value / precedent) * 100) : null;
          return (
            <div key={e.label}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="flex items-center gap-1.5 text-gray-700 dark:text-gray-200">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
                  {e.label}
                </span>
                <span className="flex items-baseline gap-2">
                  {taux !== null && <span className="text-[11px] text-gray-400">{taux} % de l&apos;étape d&apos;avant</span>}
                  <span className="font-bold text-gray-900 dark:text-white">{e.value}</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full ${e.couleur}`}
                  style={{ width: `${Math.max(e.value > 0 ? 4 : 0, Math.round((e.value / base) * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
        {activation.signedUp > 0 && (
          <p className="pt-1 text-xs text-gray-500 dark:text-gray-400">
            {Math.round((activation.paying / activation.signedUp) * 100)} % des inscrits du mois paient déjà.
          </p>
        )}
      </div>
    </Panel>
  );
}
