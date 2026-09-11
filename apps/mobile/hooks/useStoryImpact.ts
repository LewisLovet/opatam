/**
 * L'effet des stories, pour l'écran de partage : combien de stories
 * partagées, et combien de vues de la page depuis la dernière story et sur
 * les 7 derniers jours.
 *
 * Les vues viennent de `pageViewsDaily` (un doc par jour et par prestataire,
 * lisible par lui seul) en UNE requête bornée par la plus ancienne des deux
 * dates ; le jour courant, pas encore consolidé, est ajouté depuis
 * `stats.pageViews.today`. Le nombre de stories vient du compteur
 * dénormalisé `stats.stories` (tenu par recordStoryShare).
 *
 * Une story est une image sans lien cliquable : ces vues ne sont donc pas
 * « attribuées » à la story, elles mesurent l'attention autour d'elle.
 */

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '@booking-app/firebase';
import type { Provider } from '@booking-app/shared';

export interface StoryImpact {
  shared: number;
  lastSharedAt: Date | null;
  /** Vues depuis le jour de la dernière story ; `null` sans story. */
  viewsSinceLastStory: number | null;
  viewsLast7Days: number;
  loading: boolean;
}

const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function useStoryImpact(provider: Provider | null | undefined, providerId: string | null | undefined): StoryImpact {
  const stories = provider?.stats?.stories;
  const shared = stories?.shared ?? 0;
  const rawLast = stories?.lastSharedAt as unknown;
  const lastSharedAt: Date | null =
    rawLast instanceof Date
      ? rawLast
      : rawLast && typeof (rawLast as { toDate?: () => Date }).toDate === 'function'
        ? (rawLast as { toDate: () => Date }).toDate()
        : null;
  const today = provider?.stats?.pageViews?.today ?? 0;

  const [vues, setVues] = useState<{ since: number | null; week: number; loading: boolean }>({
    since: null,
    week: 0,
    loading: true,
  });

  const lastKey = lastSharedAt ? dateKey(lastSharedAt) : null;
  useEffect(() => {
    if (!providerId) return;
    let actif = true;
    const now = new Date();
    const todayKey = dateKey(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekKey = dateKey(weekStart);
    // Une seule requête, depuis la plus ancienne des deux bornes.
    const from = lastKey && lastKey < weekKey ? lastKey : weekKey;
    getDocs(
      query(
        collection(db, 'pageViewsDaily'),
        where('providerId', '==', providerId),
        where('date', '>=', from),
        orderBy('date', 'asc'),
      ),
    )
      .then((snap) => {
        if (!actif) return;
        let since = 0;
        let week = 0;
        let todayCompte = false;
        for (const d of snap.docs) {
          const x = d.data();
          const date = typeof x.date === 'string' ? x.date : '';
          const count = typeof x.count === 'number' ? x.count : 0;
          if (date === todayKey) todayCompte = true;
          if (lastKey && date >= lastKey) since += count;
          if (date >= weekKey) week += count;
        }
        // Le jour courant n'a en général pas encore son doc : compteur temps réel.
        if (!todayCompte) {
          week += today;
          if (lastKey && lastKey <= todayKey) since += today;
        }
        setVues({ since: lastKey ? since : null, week, loading: false });
      })
      .catch(() => {
        if (actif) setVues({ since: null, week: today, loading: false });
      });
    return () => {
      actif = false;
    };
  }, [providerId, lastKey, today]);

  return {
    shared,
    lastSharedAt,
    viewsSinceLastStory: vues.since,
    viewsLast7Days: vues.week,
    loading: vues.loading,
  };
}
