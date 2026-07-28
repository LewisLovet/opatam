/**
 * useWorkingRanges — plages de travail hebdomadaires, prêtes à dessiner.
 *
 * Le planning pro affichait une grille entièrement blanche : impossible de
 * savoir d'un coup d'œil quand on travaille. Ce hook fournit, par membre et
 * par jour de la semaine, les créneaux d'ouverture en MINUTES depuis
 * minuit — la seule unité que la grille manipule.
 *
 * Deux règles reprises de la disponibilité serveur :
 *  - un jour `isOpen: false` n'a aucune plage, même s'il porte des slots ;
 *  - une modification PROGRAMMÉE (`effectiveFrom` dans le futur) n'est pas
 *    encore la réalité : on garde la version applicable aujourd'hui, comme
 *    le fait le calcul de créneaux.
 *
 * `union` sert à la vue « tous les membres » : les plages y sont fusionnées,
 * sinon deux membres aux horaires décalés dessineraient deux bandes qui se
 * chevauchent au lieu d'une amplitude d'ouverture lisible.
 *
 * `loaded` distingue « pas encore chargé » de « fermé toute la semaine ».
 * Sans cette nuance, un échec réseau griserait tout le planning et se
 * lirait comme une panne.
 */

import { useCallback, useEffect, useState } from 'react';
import { availabilityRepository } from '@booking-app/firebase';
import type { Availability, TimeSlot } from '@booking-app/shared';
import { mergeRanges, type RangesByDay, type WorkingRange } from '../lib/workingRanges';

export type { RangesByDay, WorkingRange };

export interface UseWorkingRangesResult {
  byMember: Record<string, RangesByDay>;
  union: RangesByDay;
  loaded: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_BY_DAY: RangesByDay = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

function parseTime(value: string): number | null {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function toRanges(slots: TimeSlot[]): WorkingRange[] {
  const out: WorkingRange[] = [];
  for (const slot of slots) {
    const start = parseTime(slot.start);
    let end = parseTime(slot.end);
    if (start === null || end === null) continue;
    // Une fin à « 00:00 » désigne minuit de fin de journée.
    if (end === 0 && start > 0) end = 24 * 60;
    if (end <= start) continue;
    out.push({ start, end });
  }
  return mergeRanges(out);
}

export function useWorkingRanges(providerId: string | undefined): UseWorkingRangesResult {
  const [byMember, setByMember] = useState<Record<string, RangesByDay>>({});
  const [union, setUnion] = useState<RangesByDay>(EMPTY_BY_DAY);
  const [loaded, setLoaded] = useState(false);

  const fetch = useCallback(async () => {
    if (!providerId) {
      setByMember({});
      setUnion(EMPTY_BY_DAY);
      setLoaded(false);
      return;
    }
    try {
      const availabilities = await availabilityRepository.getByProvider(providerId);
      const now = new Date();
      const applicable = availabilities.filter(
        (a: Availability) => !a.effectiveFrom || a.effectiveFrom <= now,
      );

      const nextByMember: Record<string, RangesByDay> = {};
      const allByDay: Record<number, WorkingRange[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

      for (const a of applicable) {
        if (!a.memberId) continue;
        if (!nextByMember[a.memberId]) {
          nextByMember[a.memberId] = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        }
        if (a.isOpen === false) continue;
        const ranges = toRanges(a.slots ?? []);
        if (!ranges.length) continue;
        nextByMember[a.memberId][a.dayOfWeek] = mergeRanges([
          ...nextByMember[a.memberId][a.dayOfWeek],
          ...ranges,
        ]);
        allByDay[a.dayOfWeek] = [...allByDay[a.dayOfWeek], ...ranges];
      }

      for (const day of Object.keys(allByDay)) {
        allByDay[Number(day)] = mergeRanges(allByDay[Number(day)]);
      }

      setByMember(nextByMember);
      setUnion(allByDay);
      setLoaded(true);
    } catch (err) {
      // Les horaires sont un CONFORT d'affichage : leur absence ne doit
      // jamais dégrader le planning. `loaded` reste faux → rien n'est
      // grisé, la grille garde son apparence actuelle.
      console.error('Error fetching working ranges:', err);
      setLoaded(false);
    }
  }, [providerId]);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return { byMember, union, loaded, refresh: fetch };
}
