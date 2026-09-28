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
import { Repeat } from 'lucide-react';

export interface RecurrenceDraft {
  intervalWeeks: number;
  /** `Date.getDay()` : 0 = dimanche … 6 = samedi. */
  weekdays: number[];
  /** `YYYY-MM-DD`, dernier jour de départ inclus. */
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
  return { intervalWeeks: rule.intervalWeeks, weekdays: [...rule.weekdays], until: isoDepuisDate(rule.until) };
}

function versRegle(draft: RecurrenceDraft): RecurrenceRule {
  return { intervalWeeks: draft.intervalWeeks, weekdays: trierJoursSemaine(draft.weekdays), until: dateLocaleDepuisIso(draft.until) };
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
  const fin = rule.until.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
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

export function RecurrenceFields({ value, onChange, baseStart, baseEnd, fuseau, enSerie, disabled }: RecurrenceFieldsProps) {
  const periode = { startDate: baseStart, endDate: baseEnd };
  const jourDeBase = baseStart.getDay();
  const plusieursJours = baseEnd.toDateString() !== baseStart.toDateString();

  // Les jours RÉELLEMENT répétés, décidés par le paquet partagé : le jour
  // de la période saisie en fait toujours partie, et sur plusieurs jours il
  // est le seul possible.
  const weekdays = value ? regleAEnregistrer(value, periode, fuseau).weekdays : [];

  const apercu = useMemo(() => {
    if (!value) return null;
    const rule = regleAEnregistrer(value, periode, fuseau);
    const horloge = horlogeDuFuseau(fuseau);
    const raison = messageRegleInvalide(periode, rule, horloge);
    if (raison) return { erreur: raison, texte: null, nombre: 0 };
    const nombre = genererOccurrences(periode, rule, horloge).length;
    return { erreur: null, texte: decrireRecurrence(rule), nombre };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.intervalWeeks, value?.until, value?.weekdays?.join(','), baseStart.getTime(), baseEnd.getTime(), fuseau]);

  const toggleJour = (j: number) => {
    if (!value || j === jourDeBase || plusieursJours) return;
    const next = weekdays.includes(j) ? weekdays.filter((x) => x !== j) : [...weekdays, j];
    onChange({ ...value, weekdays: trierJoursSemaine(next) });
  };

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked ? brouillonParDefaut(baseStart) : null)}
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300 inline-flex items-center gap-1.5">
          <Repeat className="w-4 h-4 text-gray-400" />
          Répéter
        </span>
      </label>

      {value && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fréquence</span>
              <select
                value={value.intervalWeeks}
                disabled={disabled}
                onChange={(e) => onChange({ ...value, intervalWeeks: Number(e.target.value) })}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                {Array.from({ length: INTERVALLE_MAX_SEMAINES }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'Chaque semaine' : `Toutes les ${n} semaines`}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Jusqu'au"
              type="date"
              value={value.until}
              min={isoDepuisDate(baseStart)}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, until: e.target.value })}
              required
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {plusieursJours ? 'Le' : 'Les'}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((j) => {
                const actif = weekdays.includes(j);
                const fige = j === jourDeBase || plusieursJours;
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => toggleJour(j)}
                    disabled={disabled || fige}
                    aria-pressed={actif}
                    title={j === jourDeBase ? 'Jour de la période saisie' : undefined}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border capitalize transition-colors ${
                      actif
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'
                    } ${fige && !actif ? 'opacity-40' : ''}`}
                  >
                    {nomDuJour(j, 'short').replace('.', '')}
                  </button>
                );
              })}
            </div>
            {plusieursJours && (
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Une période de plusieurs jours se répète sur son jour de départ.
              </p>
            )}
          </div>

          {apercu?.erreur ? (
            <p role="alert" className="text-xs text-red-700 dark:text-red-300">{apercu.erreur}</p>
          ) : apercu ? (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {apercu.texte} — {apercu.nombre} fois.
              {enSerie && ' La répétition s’applique à « celle-ci et les suivantes ».'}
            </p>
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
