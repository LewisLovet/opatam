'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Loader2, MapPin, Search } from 'lucide-react';
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
  /** Personne affichée dans le panneau de droite. */
  membreSelectionneId?: string | null;
  onSelectionnerMembre: (memberId: string) => void;
}

/**
 * Une prestation que PERSONNE ne réalise.
 *
 * Le modèle ne sait pas dire « aucun prestataire » : une liste de membres
 * vide veut dire « tous ceux que le lieu autorise ». Retirer la dernière
 * personne désactive donc la prestation, ce qui la sort réellement de la
 * réservation en ligne — et c'est cet état que la ligne met en évidence.
 */
export function sansPrestataire(service: WithId<Service>): boolean {
  return service.isActive === false && (service.memberIds?.length ?? 0) === 0;
}

const COULEURS = [
  'bg-primary-500', 'bg-secondary-500', 'bg-accent-500', 'bg-success-500',
  'bg-warning-500', 'bg-error-500', 'bg-purple-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-teal-500',
];

function couleurDe(nom: string): string {
  const h = nom.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COULEURS[h % COULEURS.length];
}

function initiales(nom: string): string {
  const p = nom.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[1][0] : nom.slice(0, 2)).toUpperCase();
}

function Pastille({ membre }: { membre: WithId<Member> }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${
        membre.color ? '' : couleurDe(membre.name)
      }`}
      style={membre.color ? { backgroundColor: membre.color } : undefined}
      aria-hidden="true"
    >
      {membre.photoURL ? (
        <img src={membre.photoURL} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        initiales(membre.name)
      )}
    </span>
  );
}

/**
 * « Qui réalise quoi », en une grille.
 *
 * Chaque case dit la VÉRITÉ du tunnel de réservation, pas le contenu brut
 * du champ : une prestation sans membre désigné est réalisée par tout le
 * monde, et s'affiche donc cochée partout. Cliquer matérialise la liste
 * avant de retirer, sinon décocher ne changerait rien.
 */
export function AffectationsMatrice({
  services,
  groupes,
  onBasculer,
  enCours,
  membreSelectionneId,
  onSelectionnerMembre,
}: Props) {
  const [recherche, setRecherche] = useState('');

  const membres = useMemo(() => groupes.flatMap((g) => g.membres), [groupes]);
  const plusieursLieux = groupes.length > 1;

  const prestations = useMemo(() => {
    // Les prestations sans prestataire sont DÉSACTIVÉES : les exclure les
    // ferait disparaître au moment même où on veut les voir.
    const visibles = services.filter((s) => s.isActive !== false || sansPrestataire(s));
    const q = recherche.trim().toLowerCase();
    const filtrees = q
      ? visibles.filter((s) => s.name.toLowerCase().includes(q))
      : visibles;
    // Ce qui ne part pas en ligne remonte en tête.
    return [...filtrees].sort(
      (a, b) => Number(sansPrestataire(b)) - Number(sansPrestataire(a)),
    );
  }, [services, recherche]);

  const nbOrphelines = prestations.filter(sansPrestataire).length;

  if (membres.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Ajoutez un prestataire pour attribuer des prestations.
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
        <div className="min-w-0">
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

      {nbOrphelines > 0 && (
        <div className="flex items-start gap-2 border-b border-warning-200 bg-warning-50 px-4 py-2.5 dark:border-warning-900 dark:bg-warning-950/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-warning-600 dark:text-warning-400" />
          <p className="text-sm text-warning-900 dark:text-warning-200">
            {nbOrphelines} prestation{nbOrphelines > 1 ? 's ne sont' : ' n’est'} réalisée
            {nbOrphelines > 1 ? 's' : ''} par personne. Tant que c’est le cas,{' '}
            {nbOrphelines > 1 ? 'elles ne sont pas réservables' : 'elle n’est pas réservable'} en
            ligne. Cochez quelqu’un pour {nbOrphelines > 1 ? 'les' : 'la'} remettre en ligne.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            {plusieursLieux && (
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
            <tr className="border-b border-gray-200 bg-gray-50/40 dark:border-gray-700 dark:bg-gray-900/20">
              <th className="sticky left-0 z-10 min-w-56 bg-white px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {plusieursLieux ? 'Prestataires →' : 'Prestation'}
              </th>
              {membres.map((m) => {
                const choisi = m.id === membreSelectionneId;
                return (
                  <th
                    key={m.id}
                    className={`min-w-28 border-l border-gray-100 px-2 py-2 align-bottom dark:border-gray-700 ${
                      choisi ? 'bg-primary-50/70 dark:bg-primary-950/20' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectionnerMembre(m.id)}
                      title={`Voir et régler ${m.name}`}
                      className="mx-auto flex w-full flex-col items-center gap-1 rounded-lg px-1 py-1 transition-colors hover:bg-white dark:hover:bg-gray-800"
                    >
                      <Pastille membre={m} />
                      <span
                        className={`block w-full truncate text-center text-xs font-semibold ${
                          choisi
                            ? 'text-primary-700 dark:text-primary-300'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {m.name}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {prestations.map((service) => {
              const orpheline = sansPrestataire(service);
              return (
                <tr
                  key={service.id}
                  className={`border-b border-gray-100 last:border-0 dark:border-gray-700 ${
                    orpheline
                      ? 'bg-warning-50/50 dark:bg-warning-950/10'
                      : 'hover:bg-gray-50/60 dark:hover:bg-gray-900/20'
                  }`}
                >
                  <td
                    className={`sticky left-0 z-10 px-4 py-3 ${
                      orpheline ? 'bg-warning-50 dark:bg-warning-950/20' : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    <p
                      className={`font-medium ${
                        orpheline
                          ? 'text-warning-900 dark:text-warning-200'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {service.name}
                    </p>
                    {orpheline ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-[11px] font-semibold text-warning-800 dark:bg-warning-900/40 dark:text-warning-200">
                        <AlertTriangle className="h-3 w-3" />
                        Personne · hors ligne
                      </span>
                    ) : (
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {service.duration} min
                        {service.isAvailable === false && ' · suspendue'}
                      </p>
                    )}
                  </td>
                  {membres.map((m) => {
                    const coche = orpheline
                      ? false
                      : membreRealisePrestation(service, m.id, m.locationId);
                    const cle = `${service.id}:${m.id}`;
                    const ecrit = enCours.has(cle);
                    const colonneChoisie = m.id === membreSelectionneId;
                    return (
                      <td
                        key={m.id}
                        className={`border-l border-gray-100 px-2 py-3 text-center dark:border-gray-700 ${
                          colonneChoisie && !orpheline
                            ? 'bg-primary-50/40 dark:bg-primary-950/10'
                            : ''
                        }`}
                      >
                        <button
                          type="button"
                          disabled={ecrit}
                          onClick={() => {
                            onSelectionnerMembre(m.id);
                            void onBasculer(service.id, m.id);
                          }}
                          aria-pressed={coche}
                          aria-label={`${coche ? 'Retirer' : 'Attribuer'} ${service.name} à ${m.name}`}
                          className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50 ${
                            coche
                              ? 'border-primary-600 bg-primary-600 text-white hover:bg-primary-700'
                              : orpheline
                                ? 'border-warning-300 bg-white text-transparent hover:border-warning-500 hover:bg-warning-100 dark:border-warning-800 dark:bg-gray-900'
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
              );
            })}
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
