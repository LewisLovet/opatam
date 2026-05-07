/**
 * Provider client repository — read + restricted update access for
 * the /pro/clients (Phase 2A) and /pro/statistiques (Phase 2B)
 * pages.
 *
 * Documents are populated by the booking-write trigger and the
 * nightly cron (counters + tags). The provider can patch only
 * `notes` and `preferences` from the UI — the Firestore rule
 * enforces that field allowlist; everything else stays managed
 * by the aggregation pipeline.
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseApp } from '../lib/config';
import type { ProviderClient } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

class ProviderClientRepository {
  private db() {
    return getFirestore(getFirebaseApp());
  }

  /**
   * All clients of a provider. Returns them in arbitrary order —
   * the UI applies sort + filter client-side.
   */
  async getByProvider(providerId: string): Promise<WithId<ProviderClient>[]> {
    const q = query(
      collection(this.db(), 'providerClients'),
      where('providerId', '==', providerId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => hydrate(d));
  }

  /**
   * Bulk fetch by document id. Used by the stats page to resolve
   * top-K client hashes → names without pulling the full base.
   * Doc id pattern is `{providerId}_{clientKey}` so we construct
   * the refs directly. Returns a map keyed by clientKey for easy
   * lookup; missing docs are simply absent.
   */
  async getByKeys(
    providerId: string,
    clientKeys: string[],
  ): Promise<Map<string, WithId<ProviderClient>>> {
    if (clientKeys.length === 0) return new Map();
    const db = this.db();
    const snaps = await Promise.all(
      clientKeys.map((k) => getDoc(doc(db, 'providerClients', `${providerId}_${k}`))),
    );
    const map = new Map<string, WithId<ProviderClient>>();
    for (const s of snaps) {
      if (!s.exists()) continue;
      const c = hydrate(s);
      map.set(c.clientKey, c);
    }
    return map;
  }

  /**
   * Update the only fields the Firestore rule allows the provider
   * to write: `notes` + `preferences`. Stamping `updatedAt` from
   * the client is required because the rule's affectedKeys() check
   * includes it.
   */
  async updateNotes(
    providerId: string,
    clientKey: string,
    patch: { notes?: string | null; preferences?: Record<string, string> | null },
  ): Promise<void> {
    const ref = doc(this.db(), 'providerClients', `${providerId}_${clientKey}`);
    await updateDoc(ref, {
      ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
      ...(patch.preferences !== undefined ? { preferences: patch.preferences } : {}),
      updatedAt: new Date(),
    });
  }
}

/** Convert Firestore Timestamps back to Date so the UI gets a
 *  ProviderClient that matches the shared type. */
function hydrate(snap: DocumentSnapshot): WithId<ProviderClient> {
  const data = snap.data() as Record<string, unknown>;
  const ts = (v: unknown): Date | null =>
    v && typeof v === 'object' && 'toDate' in v
      ? (v as { toDate: () => Date }).toDate()
      : v instanceof Date
        ? v
        : null;
  return {
    id: snap.id,
    ...(data as unknown as ProviderClient),
    firstBookingAt: ts(data.firstBookingAt) ?? new Date(0),
    lastBookingAt: ts(data.lastBookingAt) ?? new Date(0),
    marketingOptInAt: ts(data.marketingOptInAt),
    marketingOptOutAt: ts(data.marketingOptOutAt),
    createdAt: ts(data.createdAt) ?? new Date(0),
    updatedAt: ts(data.updatedAt) ?? new Date(0),
  };
}

export const providerClientRepository = new ProviderClientRepository();
export { ProviderClientRepository };
