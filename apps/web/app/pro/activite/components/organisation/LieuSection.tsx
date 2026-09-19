'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, MapPin, Plus } from 'lucide-react';
import type { Location } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface Props {
  /** `null` = les membres qu'aucun lieu ne rattache. */
  lieu: WithId<Location> | null;
  nbMembres: number;
  nbPrets: number;
  ouvert: boolean;
  onBasculer: () => void;
  onAjouter?: () => void;
  children: ReactNode;
}

/**
 * Un lieu, son équipe et son état de configuration.
 *
 * Le regroupement par lieu n'est pas décoratif : un membre appartient à UN
 * lieu, et ses horaires comme ses prestations en dépendent. Un lieu sans
 * membre rattaché ne propose aucun créneau et rien ne le disait jusqu'ici —
 * d'où l'encart explicite plutôt qu'une section vide.
 */
/**
 * Beaucoup d'adresses enregistrées contiennent déjà la ville (« 25 Quai
 * Saint-Vincent, 69001 Lyon, France ») : la recoller produisait
 * « …, France, Lyon ». On ne l'ajoute que si elle manque vraiment.
 */
function adresseCourte(lieu: WithId<Location>): string {
  const adresse = (lieu.address ?? '').trim();
  const ville = (lieu.city ?? '').trim();
  if (!adresse) return ville;
  if (!ville || adresse.toLowerCase().includes(ville.toLowerCase())) return adresse;
  return `${adresse}, ${ville}`;
}

export function LieuSection({
  lieu,
  nbMembres,
  nbPrets,
  ouvert,
  onBasculer,
  onAjouter,
  children,
}: Props) {
  const complet = nbMembres > 0 && nbPrets === nbMembres;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={onBasculer}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40"
      >
        <span
          className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${
            lieu
              ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
              : 'bg-warning-50 text-warning-600 dark:bg-warning-950/30 dark:text-warning-400'
          }`}
        >
          <MapPin className="h-5 w-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white">
              {lieu?.name ?? 'Sans lieu'}
            </span>
            {lieu?.isDefault && (
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
                Principal
              </span>
            )}
            {lieu && !lieu.isActive && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Lieu désactivé
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-sm text-gray-500 dark:text-gray-400">
            {lieu ? adresseCourte(lieu) : 'Rattachez ces personnes à un lieu'}
          </span>
        </span>

        <span className="hidden flex-none text-right sm:block">
          <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
            {nbMembres} prestataire{nbMembres > 1 ? 's' : ''}
          </span>
          <span
            className={`text-xs ${
              complet
                ? 'text-gray-500 dark:text-gray-400'
                : 'text-warning-700 dark:text-warning-400'
            }`}
          >
            {nbPrets}/{nbMembres} prêt{nbPrets > 1 ? 's' : ''}
          </span>
        </span>

        {ouvert ? (
          <ChevronDown className="h-5 w-5 flex-none text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 flex-none text-gray-400" />
        )}
      </button>

      {ouvert && (
        <div className="border-t border-gray-100 dark:border-gray-700">
          {nbMembres === 0 ? (
            <div className="flex items-start gap-3 bg-warning-50/60 px-4 py-4 dark:bg-warning-950/10">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-none text-warning-600 dark:text-warning-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Aucun prestataire rattaché à ce lieu
                </p>
                <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                  Les horaires et les créneaux appartiennent aux prestataires. Tant que
                  personne n’est rattaché ici, ce lieu ne propose aucun rendez-vous.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">{children}</div>
          )}

          {onAjouter && (
            <button
              type="button"
              onClick={onAjouter}
              className="flex w-full items-center justify-center gap-2 border-t border-gray-100 px-4 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-primary-50 hover:text-primary-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-primary-950/20 dark:hover:text-primary-300"
            >
              <Plus className="h-4 w-4" />
              Ajouter un prestataire à ce lieu
            </button>
          )}
        </div>
      )}
    </section>
  );
}
