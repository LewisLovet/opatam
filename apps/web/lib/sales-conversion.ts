import { FieldValue } from 'firebase-admin/firestore';

/**
 * Conversion commerciale — le moment où un compte attribué devient PAYANT.
 *
 * C'est la base de la rémunération des commerciaux, d'où trois règles
 * absolues :
 *
 *  - IDEMPOTENT : `salesConversions/{providerId}` — un compte ne convertit
 *    qu'une fois, la clé rend le doublon structurellement impossible
 *    (les webhooks Stripe et RevenueCat rejouent leurs événements) ;
 *  - ADOSSÉ À L'ATTRIBUTION : seule `salesAttribution/{providerId}` —
 *    écrite une seule fois, par jeton signé — décide À QUI va la
 *    conversion. Aucun autre chemin ;
 *  - JAMAIS BLOQUANT : appelé en best-effort depuis les webhooks de
 *    paiement. Une erreur ici se journalise, elle ne casse jamais le
 *    traitement d'un paiement réel.
 *
 * Le MRR stocké est celui du PREMIER abonnement (mensualisé si annuel) —
 * un instantané au moment de la conversion, pas un solde vivant : les
 * upgrades/downgrades ultérieurs se mesureront depuis Stripe quand la
 * rémunération sera calculée.
 */

export interface ConversionInput {
  providerId: string;
  source: 'stripe' | 'revenuecat';
  /** Montant payé par période, en centimes. */
  amountCents: number;
  interval: 'month' | 'year';
  currency: string;
  plan: string;
}

export async function enregistrerConversionCommerciale(
  db: FirebaseFirestore.Firestore,
  input: ConversionInput,
): Promise<'enregistree' | 'deja-enregistree' | 'sans-attribution'> {
  const attributionSnap = await db.collection('salesAttribution').doc(input.providerId).get();
  if (!attributionSnap.exists) return 'sans-attribution';
  const attribution = attributionSnap.data()!;

  const conversionRef = db.collection('salesConversions').doc(input.providerId);
  const mrrCents = input.interval === 'year' ? Math.round(input.amountCents / 12) : input.amountCents;

  // Transaction : le « première fois seulement » doit tenir même si Stripe
  // et RevenueCat livrent deux événements en parallèle.
  const cree = await db.runTransaction(async (tx) => {
    const existante = await tx.get(conversionRef);
    if (existante.exists) return false;
    tx.set(conversionRef, {
      providerId: input.providerId,
      staffUid: attribution.staffUid,
      campaign: attribution.campaign ?? null,
      sector: attribution.sector ?? null,
      source: input.source,
      plan: input.plan,
      amountCents: input.amountCents,
      interval: input.interval,
      currency: input.currency.toLowerCase(),
      mrrCents,
      firstPaidAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!cree) return 'deja-enregistree';

  // Enrichissements best-effort : nom du compte, fiche pipeline, e-mail au
  // commercial. La conversion est DÉJÀ écrite — rien ici ne peut la perdre.
  try {
    const providerSnap = await db.collection('providers').doc(input.providerId).get();
    const businessName: string = providerSnap.data()?.businessName ?? 'Un compte';
    await conversionRef.update({ businessName });

    const leads = await db
      .collection('salesLeads')
      .where('ownerUid', '==', attribution.staffUid)
      .where('linkedProviderId', '==', input.providerId)
      .limit(1)
      .get();
    if (!leads.empty) {
      const leadRef = leads.docs[0].ref;
      await leadRef.update({
        stage: 'payant',
        lastInteractionAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      await db.collection('salesActivities').add({
        leadId: leadRef.id,
        authorUid: attribution.staffUid,
        type: 'changement_etape',
        stage: 'payant',
        body: `Abonnement payé (${input.plan}, ${(mrrCents / 100).toFixed(2).replace('.', ',')} €/mois)`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    const staffSnap = await db.collection('staffMembers').doc(attribution.staffUid).get();
    const staffEmail = staffSnap.data()?.email;
    const resendApiKey = process.env.RESEND_API_KEY;
    if (staffEmail && resendApiKey) {
      const { Resend } = await import('resend');
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://opatam.com';
      await new Resend(resendApiKey).emails.send({
        from: 'Opatam <noreply@kamerleontech.com>',
        to: staffEmail,
        subject: `${businessName} est maintenant abonné payant`,
        html: `
  <div style="margin:0;padding:24px 12px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e6e6e8;padding:28px 32px;">
      <h1 style="margin:0 0 14px;font-size:20px;color:#18181b;">Conversion&nbsp;: ${businessName}</h1>
      <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f3f46;">
        Le compte que vous avez amené vient de passer à l'abonnement payant
        (${input.plan}, ${(mrrCents / 100).toFixed(2).replace('.', ',')}&nbsp;€/mois).
        Il est enregistré à votre attribution.
      </p>
      <a href="${appUrl}/sales" style="display:inline-block;background:#c81e3a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Voir mon tableau de bord</a>
    </div>
  </div>`,
      });
    }
  } catch (e) {
    console.warn('[sales-conversion] enrichissement échoué (conversion déjà écrite):', e);
  }

  return 'enregistree';
}
