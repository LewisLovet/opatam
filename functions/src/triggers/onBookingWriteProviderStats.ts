/**
 * Trigger: onBookingWriteProviderStats
 *
 * Fires on any write to `bookings/{bookingId}`. Keeps the
 * pre-aggregated stats + clients collections in sync with the
 * source-of-truth bookings — so the /pro/statistiques and
 * /pro/clients pages can read pre-computed docs at fixed cost
 * regardless of history depth.
 *
 * Strategy: re-aggregate the affected slices from scratch rather
 * than apply incremental diffs. For each booking write we:
 *
 *   1. Identify affected day(s) — usually 1, but 2 if datetime
 *      changed (old day + new day).
 *   2. Re-read all bookings for (provider, day) — small query
 *      (~50 docs/day max for a heavy provider) — run the daily
 *      aggregator on that subset, write the resulting daily doc.
 *   3. Recompute the monthly doc from all dailies of that month.
 *   4. Re-aggregate the affected client's full history and write
 *      providerClients.
 *
 * Rolling snapshots (top-K, heatmap) are NOT touched here — the
 * nightly cron handles them. Stale-by-up-to-24h is acceptable for
 * those panels.
 *
 * Idempotency: writing the same day twice produces the same doc
 * (the aggregator is deterministic). Retries are safe.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendNotificationToUser } from '../utils/expoPushService';
import { sendLoyaltyRewardEmail } from '../utils/resendService';
import {
  isLoyaltyConfigValidMirror,
  hasLoyaltyAccessMirror,
  loyaltyRewardLabel,
} from '../utils/loyaltyMirror';
import {
  aggregateBookingsToClients,
  bookingFromFirestore,
  clientDocId,
  dateKeyInTz,
  getClientKey,
  type BookingLike,
} from '../lib/providerStatsAgg';
import {
  DEFAULT_TIMEZONE,
  loadProviderContext,
  recomputeDailyDoc,
  recomputeMonthlyDoc,
  type ProviderContext,
} from '../lib/providerStatsRecompute';

export const onBookingWriteProviderStats = onDocumentWritten(
  {
    document: 'bookings/{bookingId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    const providerId = (after?.providerId ?? before?.providerId) as string | undefined;
    if (!providerId) return;

    // ── Fidélité : libérer le ticket de rédemption si la résa réduite
    // est annulée (la récompense n'est pas « brûlée » — un no-show, lui,
    // la consomme définitivement). Best-effort, jamais bloquant.
    if (
      before?.status !== 'cancelled' &&
      after?.status === 'cancelled' &&
      after?.loyalty
    ) {
      try {
        const redemptions = await admin
          .firestore()
          .collection('loyaltyRedemptions')
          .where('bookingId', '==', event.params.bookingId)
          .get();
        await Promise.all(redemptions.docs.map((d) => d.ref.delete()));
        if (!redemptions.empty) {
          console.log(`[loyalty] ticket libéré (annulation ${event.params.bookingId})`);
        }
      } catch (e) {
        console.error('[loyalty] libération ticket échouée:', e);
      }
    }

    try {
      // ── Identify affected days + months + clients ────────────
      const beforeBooking = before ? bookingFromFirestore(before) : null;
      const afterBooking = after ? bookingFromFirestore(after) : null;

      const days = new Set<string>();
      if (beforeBooking) days.add(dateKeyInTz(beforeBooking.datetime, DEFAULT_TIMEZONE));
      if (afterBooking) days.add(dateKeyInTz(afterBooking.datetime, DEFAULT_TIMEZONE));

      const months = new Set<string>();
      for (const d of days) months.add(d.slice(0, 7));

      const clientKeys = new Set<string>();
      if (beforeBooking) {
        const k = getClientKey(beforeBooking);
        if (k !== 'anonymous') clientKeys.add(k);
      }
      if (afterBooking) {
        const k = getClientKey(afterBooking);
        if (k !== 'anonymous') clientKeys.add(k);
      }

      // ── Fetch provider context (name + members) once ─────────
      const ctx = await loadProviderContext(providerId);
      if (!ctx) {
        console.warn(`[onBookingWriteProviderStats] provider ${providerId} not found`);
        return;
      }

      // ── Re-aggregate each affected day ───────────────────────
      for (const date of days) {
        await recomputeDailyDoc(providerId, date, ctx);
      }

      // ── Re-aggregate each affected month ─────────────────────
      // We do this by reading all dailies of the month and rolling
      // them up. Cheaper than re-aggregating from raw bookings of
      // the whole month.
      for (const month of months) {
        await recomputeMonthlyDoc(providerId, month);
      }

      // ── Re-aggregate each affected client (CRM doc) ──────────
      for (const clientKey of clientKeys) {
        await recomputeClientDoc(providerId, clientKey, ctx);
      }
    } catch (err) {
      console.error('[onBookingWriteProviderStats] failed', err);
      // Don't rethrow — the trigger is best-effort and a failure
      // here should not block other booking-write side effects.
    }
  },
);

// ────────────────────────────────────────────────────────────────
// Client-doc recompute — local to this trigger because it's only
// driven by booking writes (activities don't touch the CRM doc).
// The day/month recomputes are imported from providerStatsRecompute.
// ────────────────────────────────────────────────────────────────

export async function recomputeClientDoc(
  providerId: string,
  clientKey: string,
  ctx: ProviderContext,
): Promise<void> {
  const db = admin.firestore();
  // Pull every booking from that client to this provider. The
  // clientKey is `email:foo@bar.com` or `id:userId`. Both shapes
  // are queryable on bookings via clientInfo.email / clientId.
  const [, value] = clientKey.split(':');
  let snap;
  if (clientKey.startsWith('email:')) {
    snap = await db
      .collection('bookings')
      .where('providerId', '==', providerId)
      .where('clientInfo.email', '==', value)
      .get();
  } else {
    snap = await db
      .collection('bookings')
      .where('providerId', '==', providerId)
      .where('clientId', '==', value)
      .get();
  }

  const bookings: BookingLike[] = snap.docs.map((d) => bookingFromFirestore(d.data()));

  // Optional: enrich registered users for canonical name/photo.
  const registeredUsers: Record<string, { displayName: string; photoURL: string | null; phone: string | null }> = {};
  if (clientKey.startsWith('id:') && bookings.length > 0) {
    const userId = clientKey.slice(3);
    const userSnap = await db.doc(`users/${userId}`).get();
    if (userSnap.exists) {
      const u = userSnap.data() ?? {};
      registeredUsers[userId] = {
        displayName: (u.displayName as string) ?? '',
        photoURL: (u.photoURL as string | null) ?? null,
        phone: (u.phone as string | null) ?? null,
      };
    }
  }

  const clients = aggregateBookingsToClients(
    bookings,
    { providerId, registeredUsers },
  );
  const client = clients.get(clientKey);
  const ref = db.collection('providerClients').doc(clientDocId(providerId, clientKey));
  if (client) {
    // ★ Preserve user-editable fields. The aggregation pipeline owns
    //   identity + counters + tags, but `notes` and `preferences` are
    //   written by the provider from /pro/clients (Phase 2 UI). A
    //   `set({ merge: false })` would wipe them on every booking
    //   write — read-modify-write here costs us 1 extra read per
    //   client update, negligible at our scale.
    const existingSnap = await ref.get();
    const previousLoyaltyCount = existingSnap.exists
      ? ((existingSnap.data()?.loyaltyConfirmedCount as number | undefined) ?? 0)
      : 0;
    if (existingSnap.exists) {
      const existing = existingSnap.data() as Partial<{
        notes: string | null;
        preferences: Record<string, string> | null;
      }>;
      if (existing.notes !== undefined) client.notes = existing.notes;
      if (existing.preferences !== undefined) client.preferences = existing.preferences;
    }
    await ref.set(client, { merge: false });

    // ── Notifications de jalons fidélité ─────────────────────
    // Langue = celle de la dernière résa comptée du client (clientLocale).
    const latestLocale = snap.docs
      .map((d) => d.data())
      .filter((b) => b.clientId === client.clientId)
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))[0]
      ?.clientLocale as string | undefined;
    await maybeSendLoyaltyMilestone(
      providerId,
      client.clientId,
      previousLoyaltyCount,
      client.loyaltyConfirmedCount,
      latestLocale === 'en' ? 'en' : 'fr',
      ctx.providerName,
      client.email,
      client.name,
    ).catch((e) => console.error('[loyaltyMilestone] échec (non bloquant):', e));
  } else {
    await ref.delete().catch(() => undefined);
  }

  // Touch ctx to keep linter happy — context is loaded for symmetry
  // with the daily/monthly path even though clients don't need
  // per-member denormalisation (yet).
  void ctx;
}

// ────────────────────────────────────────────────────────────────
// Jalons fidélité — push au client quand sa carte atteint 50 % puis
// le seuil (récompense prête). Best-effort, jamais bloquant.
// ────────────────────────────────────────────────────────────────

async function maybeSendLoyaltyMilestone(
  providerId: string,
  clientId: string | null,
  oldCount: number,
  newCount: number,
  locale: 'fr' | 'en',
  providerName: string,
  clientEmail: string | null,
  clientName: string,
): Promise<void> {
  if (!clientId || newCount <= oldCount) return;

  const db = admin.firestore();
  const p = (await db.doc(`providers/${providerId}`).get()).data();
  const loyalty = p?.settings?.loyalty as
    | { enabled?: boolean; threshold?: number; rewardType?: string; rewardValue?: number }
    | undefined;
  if (!isLoyaltyConfigValidMirror(loyalty) || !hasLoyaltyAccessMirror(p)) return;

  const T = loyalty.threshold as number;
  const pos = newCount % T;
  const armed = pos === 0 && newCount > 0;
  const half = T >= 2 ? Math.ceil(T / 2) : 0;
  const isHalf = !armed && half > 0 && pos === half;
  if (!armed && !isHalf) return;

  const reward = loyaltyRewardLabel(
    loyalty.rewardType as string,
    loyalty.rewardValue as number,
    locale,
  );

  const remaining = T - pos;
  const payload = armed
    ? locale === 'en'
      ? {
          title: 'Your reward is ready!',
          body: `At ${providerName}: ${reward} off your next booking in the app.`,
        }
      : {
          title: 'Votre récompense est prête !',
          body: `Chez ${providerName} : ${reward} sur votre prochaine réservation dans l'app.`,
        }
    : locale === 'en'
      ? {
          title: 'Loyalty card halfway there',
          body: `Only ${remaining} more appointment${remaining > 1 ? 's' : ''} at ${providerName} to get ${reward}.`,
        }
      : {
          title: 'Carte de fidélité à mi-chemin',
          body: `Plus que ${remaining} RDV chez ${providerName} pour obtenir ${reward}.`,
        };

  const userSnap = await db.doc(`users/${clientId}`).get();
  const tokens = (userSnap.data()?.pushTokens as string[] | undefined) ?? [];
  if (tokens.length > 0) {
    await sendNotificationToUser(tokens, {
      ...payload,
      data: { type: armed ? 'loyalty_armed' : 'loyalty_half', providerId },
    });
  }

  // Email UNIQUEMENT au seuil atteint (le jalon 50 % reste push seul) —
  // filet pour les clients qui ont refusé les notifications.
  if (armed && clientEmail) {
    await sendLoyaltyRewardEmail({
      clientEmail,
      clientName,
      locale,
      businessName: providerName,
      providerSlug: (p?.slug as string | undefined) ?? null,
      rewardLabel: reward,
    });
  }
  console.log(
    `[loyaltyMilestone] ${armed ? 'armed' : 'half'} → client ${clientId} chez ${providerId} (${newCount}/${T})`,
  );
}
