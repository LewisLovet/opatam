'use client';

import { useMemo, useState } from 'react';
import { Check, Loader2, MapPin, Search } from 'lucide-react';
import { membreRealisePrestation } from '@booking-app/shared';
import type { Member, Location, Service } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export interface GroupeLieu {
  lieu: WithId<Location> | null;
  membres: WithId<Member>[];
}

interface Props {
  services: WithId<Service>[];
  groupes: GroupeLieu[];
  /** Écrit l'attribution. Le parent gère l'optimisme et les erreurs. */
  onBasculer: (serviceId: string, memberId: string) => Promise<void>;
  /** Clés `serviceId:memberId` en cours d'écriture. */
  enCours: Set<string>;
}

/**
 * « Qui réalise quoi », en une grille.
 *
 * Chaque case dit la VÉRITÉ du tunnel de réservation, pas le contenu brut
 * du champ : une prestation sans membre désigné est réalisée par tout le
 * monde, et s'affiche donc cochée partout. Cliquer matérialise la liste
 * avant de retirer, sinon décocher ne changerait rien.
 */
export function AffectationsMatrice({ services, groupes, onBasculer, enCours }: Props) {
  const [recherche, setRecherche] = useState('');

  const membres = useMemo(() => groupes.flatMap((g) => g.membres), [groupes]);

  const prestations = useMemo(() => {
    const actives = services.filter((s) => s.isActive !== false);
    const q = recherche.trim().toLowerCase();
    if (!q) return actives;
    return actives.filter((s) =>
      `${s.name} ${s.categoryId ?? ''}`.toLowerCase().includes(q),
    );
  }, [services, recherche]);

  if (membres.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
        Ajoutez un prestataire pour attribuer des prestations.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Qui réalise quoi&nbsp;?</h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Une case cochée rend la prestation réservable chez cette personne.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une prestation"
            aria-label="Rechercher une prestation"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-100 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-primary-900"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {groupes.length > 1 && (
              <tr className="border-b border-gray-200 bg-gray-50/80 dark:border-gray-700 dark:bg-gray-900/40">
                <th className="sticky left-0 z-10 min-w-56 bg-gray-50 px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  Prestation
                </th>
                {groupes.map((g) => (
                  <th
                    key={g.lieu?.id ?? 'sans-lieu'}
                    colSpan={g.membres.length}
                    className="border-l border-gray-200 px-3 py-2.5 text-center dark:border-gray-700"
                  >
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                      <MapPin className="h-3.5 w-3.5 text-gray-400" />
                      {g.lieu?.name ?? 'Sans lieu'}
                    </span>
                  </th>
                ))}
              </tr>
            )}
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="sticky left-0 z-10 min-w-56 bg-white px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {groupes.length > 1 ? '' : 'Prestation'}
              </th>
              {membres.map((m) => (
                <th
                  key={m.id}
                  className="min-w-28 border-l border-gray-100 px-2 py-2.5 text-center dark:border-gray-700"
                >
                  <span className="block max-w-28 truncate text-xs font-semibold text-gray-900 dark:text-white">
                    {m.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prestations.map((service) => (
              <tr
                key={service.id}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60 dark:border-gray-700 dark:hover:bg-gray-900/20"
              >
                <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-gray-800">
                  <p className="font-medium text-gray-900 dark:text-white">{service.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {service.duration} min
                    {service.isAvailable === false && ' · suspendue'}
                  </p>
                </td>
                {membres.map((m) => {
                  const coche = membreRealisePrestation(service, m.id, m.locationId);
                  const cle = `${service.id}:${m.id}`;
                  const ecrit = enCours.has(cle);
                  return (
                    <td
                      key={m.id}
                      className="border-l border-gray-100 px-2 py-3 text-center dark:border-gray-700"
                    >
                      <button
                        type="button"
                        disabled={ecrit}
                        onClick={() => onBasculer(service.id, m.id)}
                        aria-pressed={coche}
                        aria-label={`${coche ? 'Retirer' : 'Attribuer'} ${service.name} à ${m.name}`}
                        className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                          coche
                            ? 'border-primary-600 bg-primary-600 text-white hover:bg-primary-700'
                            : 'border-gray-200 bg-white text-transparent hover:border-primary-300 hover:bg-primary-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:border-primary-700'
                        }`}
                      >
                        {ecrit ? (
                          <Loader2 className="h-4 w-4 animate-spin text-current" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {prestations.length === 0 && (
        <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
          Aucune prestation ne correspond à cette recherche.
        </p>
      )}
    </section>
  );
}
