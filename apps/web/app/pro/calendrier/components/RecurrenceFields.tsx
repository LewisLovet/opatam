'use client';

/**
 * RecurrenceFields — « Répéter » une période bloquée ou une activité.
 *
 * Partagé par BlockPeriodModal, ActivityModal et l'onglet Disponibilités :
 * un seul endroit décide de ce qu'est une récurrence à l'écran. La règle
 * elle-même (jours, intervalle, horizon) vit dans
 * `@booking-app/shared/utils/recurrence` — ici on ne fait que la saisir,
 * la décrire et la compter.
 *
 * Le brouillon garde `until` en `YYYY-MM-DD`, comme les champs de date des
 * formulaires. Il n'arrive JAMAIS tel quel au service : `regleAEnregistrer`
 * le passe par `reglePourPeriode`, la même normalisation que l'aperçu
 * affiché ici et que le schéma zod. Le brouillon pouvait sinon garder un
 * jour de semaine périmé après un changement de date — l'écran annonçait
 * alors une règle que la base ne recevait pas.
 */
import { useMemo } from 'react';
import { Input } from '@/components/ui';
import {
  genererOccurrences,
  messageRegleInvalide,
  reglePourPeriode,
  horlogeDuFuseau,
  trierJoursSemaine,
  INTERVALLE_MAX_SEMAINES,
  type RecurrenceRule,
} from '@booking-app/shared';
import { Repeat, CalendarCheck, AlertCircle } from 'lucide-react';

export interface RecurrenceDraft {
  intervalWeeks: number;
  /** `Date.getDay()` : 0 = dimanche … 6 = samedi. */
  weekdays: number[];
  /** `YYYY-MM-DD`, dernier jour de départ inclus. Comme en base. */
  until: string;
}

/** Le 4 janvier 2026 est un dimanche : `index + getDay()` donne le bon nom. */
function nomDuJour(weekday: number, forme: 'long' | 'short' = 'long'): string {
  return new Date(2026, 0, 4 + weekday).toLocaleDateString('fr-FR', { weekday: forme });
}

/** « 2026-05-03 » → `Date` locale à minuit. */
export function dateLocaleDepuisIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function isoDepuisDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Brouillon par défaut : chaque semaine, le jour de la période, pendant trois mois. */
export function brouillonParDefaut(baseStart: Date): RecurrenceDraft {
  const until = new Date(baseStart.getFullYear(), baseStart.getMonth() + 3, baseStart.getDate());
  return { intervalWeeks: 1, weekdays: [baseStart.getDay()], until: isoDepuisDate(until) };
}

/** Un brouillon depuis une règle enregistrée (édition d'une occurrence). */
export function brouillonDepuisRegle(rule: RecurrenceRule): RecurrenceDraft {
  return { intervalWeeks: rule.intervalWeeks, weekdays: [...rule.weekdays], until: rule.until };
}

function versRegle(draft: RecurrenceDraft): RecurrenceRule {
  return { intervalWeeks: draft.intervalWeeks, weekdays: trierJoursSemaine(draft.weekdays), until: draft.until };
}

/**
 * La règle à ENREGISTRER pour cette période — ce que l'écran affiche, mot
 * pour mot. Passe par `reglePourPeriode`, comme le schéma et le service :
 * un seul endroit décide des jours répétés.
 */
export function regleAEnregistrer(
  draft: RecurrenceDraft,
  base: { startDate: Date; endDate: Date },
  fuseau?: string,
): RecurrenceRule {
  return reglePourPeriode(versRegle(draft), base, horlogeDuFuseau(fuseau));
}

/** « Chaque semaine le samedi, jusqu'au 3 mai 2026 ». */
export function decrireRecurrence(rule: Pick<RecurrenceRule, 'intervalWeeks' | 'weekdays' | 'until'>): string {
  const jours = trierJoursSemaine(rule.weekdays).map((j) => nomDuJour(j));
  const quand =
    rule.intervalWeeks === 1 ? 'Chaque semaine' : `Toutes les ${rule.intervalWeeks} semaines`;
  const lesJours =
    jours.length === 1 ? `le ${jours[0]}` : `les ${jours.slice(0, -1).join(', ')} et ${jours[jours.length - 1]}`;
  const fin = dateLocaleDepuisIso(rule.until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${quand} ${lesJours}, jusqu'au ${fin}`;
}

interface RecurrenceFieldsProps {
  /** `null` = pas de répétition. */
  value: RecurrenceDraft | null;
  onChange: (next: RecurrenceDraft | null) => void;
  /** Période de base : fixe le jour obligatoire et le point de départ. */
  baseStart: Date;
  baseEnd: Date;
  /** Fuseau du LIEU — l'aperçu compte alors comme le service écrira. */
  fuseau?: string;
  /** Vrai quand la période en édition appartient déjà à une série. */
  enSerie?: boolean;
  disabled?: boolean;
}

/** Ordre d'affichage des jours : du lundi au dimanche. */
const JOURS_AFFICHES = [1, 2, 3, 4, 5, 6, 0];
const RACCOURCIS_JOURS: Array<{ label: string; jours: number[] }> = [
  { label: 'Semaine', jours: [1, 2, 3, 4, 5] },
  { label: 'Week-end', jours: [6, 0] },
  { label: 'Tous', jours: [1, 2, 3, 4, 5, 6, 0] },
];
const RACCOURCIS_FIN: Array<{ label: string; mois: number }> = [
  { label: '1 mois', mois: 1 },
  { label: '3 mois', mois: 3 },
  { label: '6 mois', mois: 6 },
  { label: '1 an', mois: 12 },
];
const memesJours = (a: number[], b: number[]) =>
  a.length === b.length && trierJoursSemaine(a).join(',') === trierJoursSemaine(b).join(',');

/** « Chaque semaine » / « Une semaine sur 2 ». */
function libelleFrequence(n: number): string {
  return n === 1 ? 'Chaque semaine' : `Une semaine sur ${n}`;
}

export function RecurrenceFields({ value, onChange, baseStart, baseEnd, fuseau, enSerie, disabled }: RecurrenceFieldsProps) {
  const periode = { startDate: baseStart, endDate: baseEnd };
  const plusieursJours = baseEnd.toDateString() !== baseStart.toDateString();

  // Les jours RÉELLEMENT répétés, décidés par le paquet partagé : ce sont
  // les jours cochés — la date saisie n'est qu'un point de départ. Sur une
  // période de plusieurs jours, un seul jour de départ.
  const regle = value ? regleAEnregistrer(value, periode, fuseau) : null;
  const weekdays = regle?.weekdays ?? [];

  const apercu = useMemo(() => {
    if (!value || !regle) return null;
    const horloge = horlogeDuFuseau(fuseau);
    const erreur = messageRegleInvalide(periode, regle, horloge);
    if (erreur) return { erreur, occurrences: [] as { startDate: Date }[] };
    return { erreur: null, occurrences: genererOccurrences(periode, regle, horloge) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.intervalWeeks, value?.until, value?.weekdays?.join(','), baseStart.getTime(), baseEnd.getTime(), fuseau]);

  /** Une date d'occurrence, lue dans le fuseau du lieu : « sam. 3 oct. ». */
  const dateCourte = (d: Date) =>
    d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', ...(fuseau ? { timeZone: fuseau } : {}) });

  const changerJours = (jours: number[]) => value && onChange({ ...value, weekdays: trierJoursSemaine(jours) });
  const basculerJour = (j: number) => {
    if (!value) return;
    // Plusieurs jours : un seul départ possible — cliquer un jour le choisit.
    if (plusieursJours) return changerJours([j]);
    changerJours(weekdays.includes(j) ? weekdays.filter((x) => x !== j) : [...weekdays, j]);
  };
  const finDans = (mois: number) => {
    const d = new Date(baseStart.getFullYear(), baseStart.getMonth() + mois, baseStart.getDate());
    // « 1 an » ne doit pas dépasser l'horizon (366 jours) : on recule d'un jour.
    if (mois === 12) d.setDate(d.getDate() - 1);
    return isoDepuisDate(d);
  };

  const resume = regle
    ? `${libelleFrequence(regle.intervalWeeks)} · ${
        weekdays.length === 7 ? 'tous les jours' : weekdays.map((j) => nomDuJour(j, 'short')).join(' ') || 'aucun jour'
      }`
    : 'Une seule fois';

  return (
    <div
      className={`rounded-2xl border transition-colors ${
        value ? 'border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-900' : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* En-tête : ce que fait la répétition, en une ligne, et l'interrupteur. */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={`flex w-9 h-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            value ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
          }`}
        >
          <Repeat className="w-[18px] h-[18px]" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-gray-900 dark:text-white">Répéter</span>
          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{resume}</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value !== null}
          aria-label="Répéter"
          disabled={disabled}
          onClick={() => onChange(value ? null : brouillonParDefaut(baseStart))}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
            value ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
          />
        </button>
      </div>

      {value && (
        <div className="space-y-4 border-t border-gray-100 dark:border-gray-800 px-4 pb-4 pt-4">
          {/* Fréquence — un sélecteur segmenté plutôt qu'un menu déroulant. */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fréquence</p>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
              {Array.from({ length: INTERVALLE_MAX_SEMAINES }, (_, i) => i + 1).map((n) => {
                const actif = value.intervalWeeks === n;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={disabled}
                    aria-pressed={actif}
                    title={libelleFrequence(n)}
                    onClick={() => onChange({ ...value, intervalWeeks: n })}
                    className={`rounded-lg py-1.5 text-xs font-medium transition-all ${
                      actif
                        ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    {n === 1 ? 'Chaque sem.' : `1 sur ${n}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Jours — des pastilles rondes, et les raccourcis usuels. */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {plusieursJours ? 'Jour de départ' : 'Jours'}
              </p>
              {!plusieursJours && (
                <div className="flex gap-2">
                  {RACCOURCIS_JOURS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => changerJours(r.jours)}
                      className={`text-xs font-medium transition-colors ${
                        memesJours(weekdays, r.jours)
                          ? 'text-primary-700 dark:text-primary-300'
                          : 'text-gray-500 hover:text-primary-600 dark:text-gray-400'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-between gap-1">
              {JOURS_AFFICHES.map((j) => {
                const actif = weekdays.includes(j);
                return (
                  <button
                    key={j}
                    type="button"
                    disabled={disabled}
                    onClick={() => basculerJour(j)}
                    aria-pressed={actif}
                    aria-label={nomDuJour(j)}
                    title={nomDuJour(j)}
                    className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                      actif
                        ? 'bg-primary-600 text-white shadow-sm shadow-primary-600/30'
                        : 'border border-gray-200 bg-white text-gray-600 hover:border-primary-300 hover:text-primary-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {nomDuJour(j, 'short').charAt(0).toUpperCase()}
                  </button>
                );
              })}
            </div>
            {plusieursJours && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Une période de plusieurs jours part d’un seul jour de la semaine.
              </p>
            )}
          </div>

          {/* Jusqu'au — une date, ou une durée d'un geste. */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Jusqu’au</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={value.until}
                min={isoDepuisDate(baseStart)}
                disabled={disabled}
                onChange={(e) => e.target.value && onChange({ ...value, until: e.target.value })}
                className="h-9 flex-1 min-w-[9.5rem] rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
              <div className="flex gap-1">
                {RACCOURCIS_FIN.map((r) => {
                  const cible = finDans(r.mois);
                  const actif = value.until === cible;
                  return (
                    <button
                      key={r.label}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange({ ...value, until: cible })}
                      className={`h-9 rounded-lg px-2.5 text-xs font-medium transition-colors ${
                        actif
                          ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:ring-primary-800'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Ce que la série va réellement poser — les vraies dates. */}
          {apercu?.erreur ? (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-900/20">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-200">{apercu.erreur}</p>
            </div>
          ) : apercu && apercu.occurrences.length > 0 ? (
            <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-3 dark:border-primary-900 dark:bg-primary-900/20">
              <div className="flex items-start gap-2.5">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {apercu.occurrences.length} {apercu.occurrences.length > 1 ? 'dates' : 'date'}
                    <span className="font-normal text-gray-600 dark:text-gray-300">
                      {' '}· du {dateCourte(apercu.occurrences[0].startDate)} au{' '}
                      {dateCourte(apercu.occurrences[apercu.occurrences.length - 1].startDate)}
                    </span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {apercu.occurrences.slice(0, 4).map((o) => (
                      <span
                        key={o.startDate.getTime()}
                        className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-primary-100 dark:bg-gray-800 dark:text-gray-200 dark:ring-primary-900"
                      >
                        {dateCourte(o.startDate)}
                      </span>
                    ))}
                    {apercu.occurrences.length > 4 && (
                      <span className="px-1 py-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        +{apercu.occurrences.length - 4}
                      </span>
                    )}
                  </div>
                  {enSerie && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Enregistrer vous demandera : cette occurrence seulement, ou celle-ci et les suivantes.
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * « Cette occurrence seulement » ou « celle-ci et les suivantes » — posé
 * en ligne, à la place du pied de la modale, quand la période appartient
 * à une série.
 */
export function ChoixPortee({
  action,
  onCette,
  onSuivantes,
  onAnnuler,
  occupe,
}: {
  action: 'enregistrer' | 'supprimer';
  onCette: () => void;
  onSuivantes: () => void;
  onAnnuler: () => void;
  occupe?: boolean;
}) {
  const verbe = action === 'supprimer' ? 'Supprimer' : 'Appliquer à';
  return (
    <div className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        Cette période fait partie d’une répétition.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCette}
          disabled={occupe}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          {verbe} cette occurrence seulement
        </button>
        <button
          type="button"
          onClick={onSuivantes}
          disabled={occupe}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium text-white ${
            action === 'supprimer' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
          }`}
        >
          {verbe} celle-ci et les suivantes
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          disabled={occupe}
          className="px-3 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}

/** Liste des rendez-vous qu'un blocage recouvrirait — on prévient, on n'annule rien. */
export function AvertissementConflits({
  bookings,
  onConfirmer,
  onAnnuler,
  occupe,
  verbe,
}: {
  bookings: Array<{ id: string; datetime: Date; serviceName: string; clientInfo: { name: string } }>;
  onConfirmer: () => void;
  onAnnuler: () => void;
  occupe?: boolean;
  verbe: string;
}) {
  const visibles = bookings.slice(0, 6);
  return (
    <div className="w-full rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2">
      <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
        {bookings.length === 1
          ? 'Un rendez-vous tombe sur cette période.'
          : `${bookings.length} rendez-vous tombent sur ces dates.`}{' '}
        Ils ne seront pas annulés : à vous de les déplacer ou de prévenir.
      </p>
      <ul className="text-xs text-amber-900 dark:text-amber-200 space-y-0.5">
        {visibles.map((b) => (
          <li key={b.id}>
            {b.datetime.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}{' '}
            {b.datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} — {b.clientInfo.name} · {b.serviceName}
          </li>
        ))}
        {bookings.length > visibles.length && <li>… et {bookings.length - visibles.length} autre(s)</li>}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onConfirmer}
          disabled={occupe}
          className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700"
        >
          {verbe} quand même
        </button>
        <button
          type="button"
          onClick={onAnnuler}
          disabled={occupe}
          className="px-3 py-1.5 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900"
        >
          Revenir
        </button>
      </div>
    </div>
  );
}
