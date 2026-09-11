import type Stripe from 'stripe';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Commissions des ambassadeurs — versées tout de suite, ou MISES EN ATTENTE.
 *
 * Avant : quand le compte Stripe de l'ambassadeur n'était pas activé (26 sur
 * 29 le 2026-09-11), le webhook sautait le transfert et n'écrivait rien. La
 * commission était perdue, pas reportée — et l'ambassadeur, qui finissait
 * son activation plus tard, ne touchait jamais ce qu'il avait apporté.
 *
 * Maintenant : chaque paiement commissionnable écrit un doc
 * `affiliateCommissions/{cléPaiement}` (idempotent : un paiement = un doc).
 * Compte activé → transfert immédiat, doc `paid`. Sinon doc `pending`, et
 * `verserCommissionsEnAttente` les règle dès que `account.updated` passe
 * le compte à `active`. Un paiement remboursé entre-temps → doc `cancelled`.
 */

export interface CommissionInput {
  affiliateId: string;
  affiliateCode: string | null;
  providerId: string;
  /** Montant réellement payé (après remise), en centimes. */
  amountPaid: number;
  /** Charge Stripe qui finance le transfert (source_transaction). */
  chargeId: string | null;
  paymentIntentId: string | null;
  /** Clé d'idempotence : id de facture ou de session checkout. */
  paymentKey: string;
  source: 'checkout' | 'invoice';
}

type Db = FirebaseFirestore.Firestore;

async function transferer(
  stripe: Stripe,
  db: Db,
  docId: string,
  data: {
    affiliateId: string;
    affiliateCode: string | null;
    providerId: string;
    amountPaid: number;
    commission: number;
    commissionRate: number;
    chargeId: string | null;
    paymentIntentId: string | null;
    source: string;
    stripeAccountId: string;
    affiliateStats: Record<string, number> | undefined;
  },
): Promise<string> {
  const transfer = await stripe.transfers.create(
    {
      amount: data.commission,
      currency: 'eur',
      destination: data.stripeAccountId,
      ...(data.chargeId ? { source_transaction: data.chargeId } : {}),
      metadata: {
        affiliateCode: data.affiliateCode || '',
        affiliateId: data.affiliateId,
        providerId: data.providerId,
        source: data.source,
        commissionDoc: docId,
      },
    },
    // Un même paiement ne peut pas être commissionné deux fois, même si le
    // webhook est rejoué.
    { idempotencyKey: `affiliate-commission:${docId}` },
  );

  await db.collection('affiliates').doc(data.affiliateId).update({
    'stats.totalRevenue': (data.affiliateStats?.totalRevenue || 0) + data.amountPaid,
    'stats.totalCommission': (data.affiliateStats?.totalCommission || 0) + data.commission,
    updatedAt: new Date(),
  });
  await db.collection('_affiliateLogs').add({
    type: 'payment',
    affiliateId: data.affiliateId,
    affiliateCode: data.affiliateCode,
    providerId: data.providerId,
    paymentIntentId: data.paymentIntentId,
    transferId: transfer.id,
    amount: data.amountPaid,
    commission: data.commission,
    commissionRate: data.commissionRate,
    source: data.source,
    createdAt: new Date(),
  });
  return transfer.id;
}

/**
 * À appeler pour chaque paiement d'abonnement d'un compte parrainé.
 * Ne lève jamais : les erreurs sont journalisées, le paiement est déjà traité.
 */
export async function commissionnerPaiement(
  stripe: Stripe,
  db: Db,
  input: CommissionInput,
): Promise<'paid' | 'pending' | 'skipped'> {
  if (!input.affiliateId || !input.amountPaid || input.amountPaid <= 0) return 'skipped';

  const affiliateDoc = await db.collection('affiliates').doc(input.affiliateId).get();
  if (!affiliateDoc.exists) return 'skipped';
  const affiliate = affiliateDoc.data()!;
  if (!affiliate.isActive) return 'skipped';

  const commissionRate = Number(affiliate.commission) || 0;
  const commission = Math.round(input.amountPaid * (commissionRate / 100));
  if (commission <= 0) return 'skipped';

  const docId = `${input.source}_${input.paymentKey}`.replace(/[^A-Za-z0-9_-]/g, '_');
  const ref = db.collection('affiliateCommissions').doc(docId);
  const existing = await ref.get();
  if (existing.exists && existing.data()?.status !== 'pending') {
    // Déjà réglé (ou annulé) — webhook rejoué.
    return existing.data()?.status === 'paid' ? 'paid' : 'skipped';
  }

  const base = {
    affiliateId: input.affiliateId,
    affiliateCode: input.affiliateCode ?? affiliate.code ?? null,
    providerId: input.providerId,
    amountPaid: input.amountPaid,
    commission,
    commissionRate,
    chargeId: input.chargeId,
    paymentIntentId: input.paymentIntentId,
    source: input.source,
  };

  const compteActif = !!affiliate.stripeAccountId && affiliate.stripeAccountStatus === 'active';
  if (!compteActif) {
    await ref.set(
      {
        ...base,
        status: 'pending',
        pendingReason: affiliate.stripeAccountId
          ? `stripe_${affiliate.stripeAccountStatus || 'unknown'}`
          : 'no_stripe_account',
        createdAt: existing.exists ? existing.data()?.createdAt : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(
      `[affiliate] commission ${commission}c pour ${base.affiliateCode} MISE EN ATTENTE (compte Stripe ${affiliate.stripeAccountStatus || 'absent'})`,
    );
    return 'pending';
  }

  const transferId = await transferer(stripe, db, docId, {
    ...base,
    stripeAccountId: affiliate.stripeAccountId,
    affiliateStats: affiliate.stats,
  });
  await ref.set(
    {
      ...base,
      status: 'paid',
      transferId,
      createdAt: existing.exists ? existing.data()?.createdAt : FieldValue.serverTimestamp(),
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  console.log(`[affiliate] commission ${commission}c → ${base.affiliateCode} (${transferId})`);
  return 'paid';
}

/**
 * Règle les commissions en attente d'un ambassadeur — à appeler quand son
 * compte Stripe passe à `active`. Un paiement remboursé entre-temps n'est
 * plus dû : le doc passe `cancelled`.
 */
export async function verserCommissionsEnAttente(
  stripe: Stripe,
  db: Db,
  affiliateId: string,
): Promise<{ paid: number; cancelled: number; errors: number }> {
  const bilan = { paid: 0, cancelled: 0, errors: 0 };
  const affiliateDoc = await db.collection('affiliates').doc(affiliateId).get();
  const affiliate = affiliateDoc.data();
  if (!affiliate?.stripeAccountId || affiliate.stripeAccountStatus !== 'active') return bilan;

  const snap = await db
    .collection('affiliateCommissions')
    .where('affiliateId', '==', affiliateId)
    .where('status', '==', 'pending')
    .get();
  if (snap.empty) return bilan;

  // Les stats sont relues à chaque itération : `transferer` les incrémente.
  for (const doc of snap.docs) {
    const d = doc.data();
    try {
      if (d.chargeId) {
        const charge = await stripe.charges.retrieve(d.chargeId);
        if (charge.refunded || charge.amount_refunded >= charge.amount) {
          await doc.ref.update({ status: 'cancelled', cancelReason: 'refunded', updatedAt: FieldValue.serverTimestamp() });
          bilan.cancelled++;
          continue;
        }
      }
      const fresh = (await db.collection('affiliates').doc(affiliateId).get()).data()!;
      const transferId = await transferer(stripe, db, doc.id, {
        affiliateId,
        affiliateCode: d.affiliateCode ?? null,
        providerId: d.providerId,
        amountPaid: d.amountPaid,
        commission: d.commission,
        commissionRate: d.commissionRate,
        chargeId: d.chargeId ?? null,
        paymentIntentId: d.paymentIntentId ?? null,
        source: d.source ?? 'invoice',
        stripeAccountId: fresh.stripeAccountId,
        affiliateStats: fresh.stats,
      });
      await doc.ref.update({ status: 'paid', transferId, paidAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      bilan.paid++;
    } catch (e) {
      bilan.errors++;
      console.error(`[affiliate] versement en attente ${doc.id} échoué:`, e);
    }
  }
  console.log(`[affiliate] ${affiliateId} : ${bilan.paid} commission(s) en attente versée(s), ${bilan.cancelled} annulée(s), ${bilan.errors} erreur(s)`);
  return bilan;
}
