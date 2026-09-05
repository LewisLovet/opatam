/**
 * useAvailabilitySummary Hook
 *
 * Per-day availability for the booking calendar over a range, in ONE call to
 * `/api/availability-summary` (côté serveur, fuseau Europe/Paris forcé).
 *
 * POURQUOI le serveur et plus le calcul sur l'appareil : le moteur de
 * créneaux matérialise les horaires du salon avec les composantes locales de
 * la machine qui l'exécute. Sur le téléphone d'une cliente dans un autre
 * fuseau (Guadeloupe, UTC−4…), « 14:00 » devenait 14:00 HEURE LOCALE — un
 * instant décalé de plusieurs heures, envoyé tel quel à /api/bookings, donc
 * une réservation à la mauvaise heure dans l'agenda du pro. Le serveur
 * renvoie des instants absolus (ISO) + des libellés « HH:MM » en heure du
 * salon, à afficher tels quels.
 */

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '../lib/config';
import type { TimeSlot } from './useAvailableSlots';
import i18n from '../lib/i18n';

export type DayStatus =
  | 'available'
  | 'almost_full'
  | 'full'
  | 'closed'
  /** Le professionnel est ouvert, mais la prestation choisie n'est pas
   *  proposée ce jour-là. Distinct de `closed` et de `full` : dire « fermé »
   *  accuserait le professionnel d'être absent, « complet » ferait croire à
   *  une forte demande. */
  | 'service_closed';

export interface DayInfo {
  status: DayStatus;
  capacity: number;
  slots: TimeSlot[];
}

export interface UseAvailabilitySummaryParams {
  providerId: string | undefined;
  serviceId: string | undefined;
  memberId: string | undefined;
  startDate: Date;
  endDate: Date;
  /** Full effective visit length (variations + last service buffer). */
  durationOverride?: number;
  /** Prestations secondaires du panier : elles restreignent les jours,
   *  sans changer la durée (déjà agrégée dans `durationOverride`). */
  extraServiceIds?: string[];
}

export interface UseAvailabilitySummaryResult {
  /** Keyed by local YYYY-MM-DD. */
  summary: Record<string, DayInfo>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAvailabilitySummary(
  params: UseAvailabilitySummaryParams,
): UseAvailabilitySummaryResult {
  const { providerId, serviceId, memberId, startDate, endDate, durationOverride, extraServiceIds } = params;
  // Empreinte stable du panier : c'est elle qui pilote le rechargement.
  const extraServiceIdsKey = extraServiceIds?.join(',') ?? '';

  const [summary, setSummary] = useState<Record<string, DayInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!providerId || !serviceId || !memberId) {
      setSummary({});
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // Bornes en JOURS calendaires (YYYY-MM-DD locaux) — jamais des ISO,
      // qui désigneraient le mauvais jour depuis un autre fuseau.
      const toKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const params = new URLSearchParams({
        providerId,
        serviceId,
        memberId,
        start: toKey(startDate),
        end: toKey(endDate),
      });
      if (durationOverride) params.set('duration', String(durationOverride));
      if (extraServiceIdsKey) params.set('extraServiceIds', extraServiceIdsKey);
      const res = await fetch(`${API_URL}/api/availability-summary?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || i18n.t('errors.availability.loadFailed'));
      const map: Record<string, DayInfo> = {};
      for (const d of body.days as Array<{
        date: string;
        status: DayStatus;
        capacity: number;
        slots: Array<{ date: string; start: string; end: string; datetime: string; endDatetime: string }>;
      }>) {
        map[d.date] = {
          status: d.status,
          capacity: d.capacity,
          slots: d.slots.map((s) => ({
            date: new Date(s.date),
            start: s.start,
            end: s.end,
            datetime: new Date(s.datetime),
            endDatetime: new Date(s.endDatetime),
          })),
        };
      }
      setSummary(map);
    } catch (err: any) {
      console.error('Error fetching availability summary:', err);
      setError(err.message || i18n.t('errors.availability.loadFailed'));
      setSummary({});
    } finally {
      setLoading(false);
    }
    // `extraServiceIdsKey` et NON le tableau : un tableau est recréé à chaque
    // rendu du parent, donc sa référence change sans que son contenu bouge —
    // le mettre en dépendance déclencherait un rechargement à chaque rendu.
    // La chaîne, elle, ne change que si le panier change vraiment.
  }, [
    providerId,
    serviceId,
    memberId,
    startDate.getTime(),
    endDate.getTime(),
    durationOverride,
    extraServiceIdsKey,
  ]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const refresh = useCallback(async () => {
    await fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refresh };
}
