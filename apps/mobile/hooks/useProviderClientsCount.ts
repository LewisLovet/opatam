/**
 * useProviderClientsCount Hook
 *
 * Lightweight count-only query against `providerClients` for the
 * given provider, used by the More menu badge next to the
 * "Clients" entry. Mirrors the existing pattern around "Avis
 * clients" (provider.rating.count) and "Créneaux bloqués"
 * (blockedSlots.length) so the menu reads consistently.
 *
 * Uses Firestore's `getCountFromServer` aggregation — one
 * round-trip, returns just the number, no docs transferred.
 * Cheaper than pulling the whole list when we only want the count.
 */

import { useEffect, useState } from 'react';
import {
  collection,
  getCountFromServer,
  getFirestore,
  query,
  where,
} from 'firebase/firestore';
import { getFirebaseApp } from '@booking-app/firebase';

export function useProviderClientsCount(
  providerId: string | undefined,
): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!providerId) {
      setCount(null);
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const db = getFirestore(getFirebaseApp());
        const q = query(
          collection(db, 'providerClients'),
          where('providerId', '==', providerId),
        );
        const snap = await getCountFromServer(q);
        if (!cancelled) setCount(snap.data().count);
      } catch (err) {
        // Soft-fail — the badge is informational, no point
        // alarming the user if the count can't be resolved.
        console.warn('[useProviderClientsCount]', err);
        if (!cancelled) setCount(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  return count;
}
