import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { decideAffiliateLink, type AffiliateLinkDecision } from './affiliate-link';

/**
 * Rattachement affilié ATOMIQUE.
 *
 * La version précédente lisait le provider, décidait, puis écrivait le
 * rattachement et les statistiques en deux updates séparés. Deux requêtes
 * simultanées (double clic, retry réseau) lisaient toutes deux
 * `affiliateId: null`, chacune rattachait et incrémentait — double
 * comptabilisation, et le dernier écrivain gagnait sur le provider.
 *
 * Ici, la relecture du provider, le contrôle « pas déjà rattaché »,
 * l'écriture du lien ET l'incrément des stats vivent dans UNE transaction
 * Firestore. En cas de contention, le perdant est rejoué, relit un
 * `affiliateId` désormais non nul, et ressort en `alreadyLinked` sans rien
 * écrire. La décision elle-même reste `decideAffiliateLink` — pure et testée
 * à part — appelée sur la lecture transactionnelle.
 *
 * La validation du code (l'affilié actif) reste hors transaction : elle ne
 * dépend d'aucune donnée que la course pourrait changer.
 */
export async function runAffiliateLink(
  db: Firestore,
  input: {
    authUid: string | null;
    providerId: string;
    /** Code normalisé (majuscules, trim) — écrit tel quel. */
    code: string;
    affiliate: { id: string } | null;
  },
): Promise<AffiliateLinkDecision> {
  const providerRef = db.collection('providers').doc(input.providerId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(providerRef);
    const decision = decideAffiliateLink({
      authUid: input.authUid,
      providerId: input.providerId,
      provider: snap.exists
        ? (snap.data() as { userId?: string | null; affiliateId?: string | null })
        : null,
      affiliate: input.affiliate,
    });
    if (!decision.ok || decision.alreadyLinked) return decision;

    tx.update(providerRef, {
      affiliateCode: input.code,
      affiliateId: decision.affiliateId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.update(db.collection('affiliates').doc(decision.affiliateId), {
      'stats.totalReferrals': FieldValue.increment(1),
      'stats.trialReferrals': FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return decision;
  });
}
