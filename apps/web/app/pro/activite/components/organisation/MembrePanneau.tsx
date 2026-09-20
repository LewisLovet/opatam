'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Settings2,
} from 'lucide-react';
import { Switch } from '@/components/ui';
import { CopierHorairesVers } from './CopierHorairesVers';
import { formatPrice, membreRealisePrestation } from '@booking-app/shared';
import type { Member, Location, Service, EtatMembre } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface Props {
  membre: WithId<Member>;
  lieux: WithId<Location>[];
  services: WithId<Service>[];
  etat?: EtatMembre;
  creneaux: number | null;
  /** « Lun–Ven · 9h–18h », ou `null` si rien n'est enregistré. */
  resumeHoraires: string | null;
  /** Collègues dont les horaires peuvent être recopiés VERS cette personne. */
  sources: { id: string; name: string; resume: string }[];
  /** Collègues vers qui recopier les horaires DE cette personne. */
  cibles: { id: string; name: string; resume: string | null }[];
  /** Clés `serviceId:memberId` en cours d'écriture. */
  enCours: Set<string>;
  copieEnCours: boolean;
  changementLieuEnCours: boolean;
  onBasculerPrestation: (serviceId: string, memberId: string) => Promise<void>;
  onChangerLieu: (memberId: string, locationId: string) => Promise<void>;
  onCopierHoraires: (sourceId: string, cibleId: string) => Promise<void>;
  onCopierVers: (sourceId: string, cibleIds: string[]) => void;
  onBasculerActif: (memberId: string, actif: boolean) => Promise<void>;
  onOuvrirFiche: () => void;
  onDefinirHoraires: () => void;
}

function initiales(nom: string): string {
  const parts = nom.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return nom.slice(0, 2).toUpperCase();
}

/**
 * Tout ce qu'on peut corriger sur une personne, au même endroit.
 *
 * C'est le cœur de la page : sans ce panneau, régler un membre demandait
 * d'ouvrir une modale pour les prestations, puis de changer d'onglet pour
 * les horaires, sans jamais voir l'effet des deux ensemble.
 */
export function MembrePanneau({
  membre,
  lieux,
  services,
  etat,
  creneaux,
  resumeHoraires,
  sources,
  cibles,
  enCours,
  copieEnCours,
  changementLieuEnCours,
  onBasculerPrestation,
  onChangerLieu,
  onCopierHoraires,
  onCopierVers,
  onBasculerActif,
  onOuvrirFiche,
  onDefinirHoraires,
}: Props) {
  const [source, setSource] = useState<string>('');
  // Désactiver déclenche une lecture des réservations puis une fenêtre :
  // sans ce verrou, un double clic lançait deux fois la manœuvre.
  const [basculeEnCours, setBasculeEnCours] = useState(false);

  // Les prestations du lieu de la personne, plus celles qu'on lui a
  // attribuées explicitement ailleurs : en cacher une ferait disparaître
  // une case qu'on ne pourrait plus décocher.
  const prestations = useMemo(() => {
    return services
      .filter((s) => s.isActive !== false)
      .filter(
        (s) =>
          (membre.locationId && s.locationIds.includes(membre.locationId)) ||
          membreRealisePrestation(s, membre.id, membre.locationId),
      );
  }, [services, membre]);

  const retenues = prestations.filter((s) =>
    membreRealisePrestation(s, membre.id, membre.locationId),
  );

  const sourceChoisie = source || sources[0]?.id || '';
  const bloque = membre.isActive && etat ? !etat.reservable : false;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Identité */}
      <div className="flex items-start gap-3 border-b border-gray-100 p-4 dark:border-gray-700">
        <span
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary-500 text-base font-semibold text-white"
          style={membre.color ? { backgroundColor: membre.color } : undefined}
        >
          {membre.photoURL ? (
            <img src={membre.photoURL} alt="" className="h-full w-full rounded-full object-cover" />
          ) : (
            initiales(membre.name)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
              {membre.name}
            </h3>
            <button
              type="button"
              onClick={onOuvrirFiche}
              className="flex-none rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              title="Fiche complète (identité, code d’accès, suppression)"
              aria-label="Ouvrir la fiche complète"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {!membre.isActive ? (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                Désactivé
              </span>
            ) : bloque ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[11px] font-semibold text-warning-700 dark:bg-warning-900/20 dark:text-warning-400">
                <AlertTriangle className="h-3 w-3" /> À compléter
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-[11px] font-semibold text-success-700 dark:bg-success-900/20 dark:text-success-400">
                <CheckCircle2 className="h-3 w-3" /> Prêt
              </span>
            )}
            {membre.isActive && creneaux !== null && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {creneaux} créneau{creneaux > 1 ? 'x' : ''} cette semaine
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4">
        {/* Ce que fait l'interrupteur, écrit noir sur blanc. Sur la ligne de
            liste il n'y a pas la place de l'expliquer, et « à quoi sert ce
            bouton ? » est la première question qu'il provoque. */}
        <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 dark:border-gray-700">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Reçoit des réservations
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              {membre.isActive
                ? 'Cette personne apparaît dans le tunnel de réservation.'
                : 'Désactivée : elle n’apparaît plus, et ses créneaux ne sont plus proposés.'}
            </p>
          </div>
          <div className="flex-none pt-0.5">
            <Switch
              checked={membre.isActive}
              disabled={basculeEnCours}
              onChange={async (e) => {
                setBasculeEnCours(true);
                try {
                  await onBasculerActif(membre.id, e.target.checked);
                } finally {
                  setBasculeEnCours(false);
                }
              }}
              aria-label={membre.isActive ? 'Désactiver cette personne' : 'Activer cette personne'}
            />
          </div>
        </div>

        {/* Lieu */}
        <div>
          <label
            htmlFor="panneau-lieu"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
          >
            Lieu de rattachement
          </label>
          <select
            id="panneau-lieu"
            value={membre.locationId ?? ''}
            disabled={changementLieuEnCours}
            onChange={(e) => onChangerLieu(membre.id, e.target.value)}
            // Une molette au-dessus d'un select natif change sa valeur.
            // Sur un contrôle qui écrit en base, ça déplace quelqu'un de
            // lieu sans que personne l'ait demandé : on refuse la molette.
            onWheel={(e) => e.currentTarget.blur()}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:focus:ring-primary-900"
          >
            {!membre.locationId && <option value="">Aucun lieu</option>}
            {lieux.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Une personne appartient à un seul lieu. Ses horaires suivent.
          </p>
        </div>

        {/* Prestations */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Prestations réalisées
            </p>
            <span
              className={`text-xs font-semibold ${
                retenues.length === 0
                  ? 'text-warning-700 dark:text-warning-400'
                  : 'text-primary-600 dark:text-primary-400'
              }`}
            >
              {retenues.length}/{prestations.length}
            </span>
          </div>

          {prestations.length === 0 ? (
            <p className="rounded-lg bg-warning-50 px-3 py-2.5 text-sm text-warning-800 dark:bg-warning-950/20 dark:text-warning-300">
              Aucune prestation n’est rattachée à ce lieu. Ajoutez-en une depuis l’onglet
              Prestations.
            </p>
          ) : (
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
              {prestations.map((service) => {
                const coche = membreRealisePrestation(service, membre.id, membre.locationId);
                const cle = `${service.id}:${membre.id}`;
                const ecrit = enCours.has(cle);
                return (
                  <button
                    key={service.id}
                    type="button"
                    disabled={ecrit}
                    onClick={() => onBasculerPrestation(service.id, membre.id)}
                    aria-pressed={coche}
                    className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors disabled:opacity-60 ${
                      coche
                        ? 'border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/30'
                        : 'border-gray-200 hover:border-primary-200 dark:border-gray-700 dark:hover:border-primary-800'
                    }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-none items-center justify-center rounded border ${
                        coche
                          ? 'border-primary-600 bg-primary-600 text-white'
                          : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900'
                      }`}
                    >
                      {ecrit ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-600" />
                      ) : (
                        coche && <Check className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                        {service.name}
                      </span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {service.duration} min · {formatPrice(service.price)}
                        {service.isAvailable === false && ' · suspendue'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Horaires */}
        <div
          className={`rounded-lg border p-3 ${
            resumeHoraires
              ? 'border-success-200 bg-success-50/60 dark:border-success-900 dark:bg-success-950/10'
              : 'border-warning-200 bg-warning-50/70 dark:border-warning-900 dark:bg-warning-950/10'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <CalendarCheck
              className={`mt-0.5 h-5 w-5 flex-none ${
                resumeHoraires
                  ? 'text-success-600 dark:text-success-400'
                  : 'text-warning-600 dark:text-warning-400'
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {resumeHoraires ?? 'Aucun horaire enregistré'}
              </p>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                {resumeHoraires
                  ? 'Ces horaires servent à calculer les créneaux proposés aux clientes.'
                  : 'Sans horaires, aucun créneau n’existe, même avec des prestations attribuées.'}
              </p>
            </div>
          </div>

          {!resumeHoraires && sources.length > 0 && (
            <div className="mt-3 space-y-2">
              {sources.length > 1 && (
                <select
                  value={sourceChoisie}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Personne dont copier les horaires"
                  className="w-full rounded-lg border border-warning-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 outline-none dark:border-warning-900 dark:bg-gray-900 dark:text-white"
                >
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.resume}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={copieEnCours || !sourceChoisie}
                onClick={() => onCopierHoraires(sourceChoisie, membre.id)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-warning-800 shadow-sm ring-1 ring-warning-200 transition-colors hover:bg-warning-50 disabled:opacity-60 dark:bg-gray-900 dark:text-warning-300 dark:ring-warning-900"
              >
                {copieEnCours ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Copier les horaires de{' '}
                {sources.find((s) => s.id === sourceChoisie)?.name ?? sources[0].name}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onDefinirHoraires}
            className="mt-2 w-full rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 underline-offset-2 hover:underline dark:text-gray-300"
          >
            {resumeHoraires ? 'Modifier les horaires' : 'Les définir à la main'}
          </button>

          {resumeHoraires && (
            <CopierHorairesVers
              sourceNom={membre.name}
              cibles={cibles}
              enCours={copieEnCours}
              onCopier={(ids) => onCopierVers(membre.id, ids)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
