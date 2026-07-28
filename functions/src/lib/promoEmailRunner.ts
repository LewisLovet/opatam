/**
 * Exécution d'un envoi d'emails promo — partagée par le trigger (promo
 * créée / modifiée) et le cron (promo programmée qui devient active).
 *
 * Un seul chemin d'exécution pour les deux appelants : c'est la seule façon
 * de garantir qu'une promo programmée part exactement comme une promo
 * immédiate, sans doublon.
 *
 * ORDRE DES OPÉRATIONS (c'est là qu'était le bug) :
 *   1. décider (pur, testé dans lib/promoNotification) ;
 *   2. revérifier que le prestataire est TOUJOURS éligible ;
 *   3. lire le throttle 7 j SANS le consommer ;
 *   4. chercher les destinataires ;
 *   5. seulement s'il en existe au moins un, réserver ATOMIQUEMENT le
 *      throttle + la signature, puis envoyer, puis clôturer le registre.
 *
 * L'ancienne version consommait le throttle à l'étape 2 : un pro sans aucun
 * client opt-in brûlait sa fenêtre de 7 jours et ses promos suivantes
 * étaient bloquées alors qu'aucun email n'était jamais parti.
 *
 * La réservation reste AVANT l'envoi : en cas de double exécution
 * concurrente (retry Firestore, trigger + cron le même jour), mieux vaut
 * perdre un envoi que d'écrire deux fois dans la boîte du client.
 *
 * ÉCHEC D'ENVOI — PAS DE REPRISE (décision produit). Une offre traitée est
 * traitée : le registre la ferme quel que soit le résultat, et la fenêtre
 * de 7 jours reste consommée. Un email refusé par Resend n'est jamais
 * renvoyé automatiquement — le risque de doublon dans la boîte d'un client
 * pèse plus lourd qu'une promo manquée.
 *
 * Le registre garde en revanche de quoi CONSTATER l'incident : statut,
 * destinataires visés / servis, nombre de tentatives, horodatages et
 * dernier message d'erreur. C'est ce que lit la vue
 * /admin/marketing/promos-fidelite, seule surface exposant ces échecs (rien
 * n'alourdit le parcours du prestataire).
 *
 * ÉLIGIBILITÉ. Le cron peut passer des semaines après la mise en ligne de
 * l'offre : l'abonnement du pro est revérifié au moment de l'envoi, jamais
 * supposé depuis l'état du jour de création.
 *
 * La trace « offre déjà notifiée » vit dans un registre à part
 * (`providers/{id}/promoNotifications/{serviceId}`) et NON dans
 * `service.discount` : le formulaire du pro réécrit l'objet `discount`
 * entier à chaque enregistrement et le schéma zod retire les clés qu'il ne
 * connaît pas — la signature aurait été effacée au premier changement de
 * libellé, et l'email reparti.
 */

import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { sendRawEmail } from '../utils/resendService';
import { decidePromoNotification, localToday, type PromoNotificationInput } from './promoNotification';
import { hasLoyaltyAccessMirror, isLoyaltyConfigValidMirror } from '../utils/loyaltyMirror';

const THROTTLE_MS = 7 * 24 * 60 * 60 * 1000;
const APP_URL = 'https://opatam.com';

type Locale = 'fr' | 'en' | 'it' | 'pt';

const TEXTS: Record<
  Locale,
  {
    subject: (p: string) => string;
    hello: (n: string) => string;
    body: (p: string, s: string, pct: number) => string;
    until: (d: string) => string;
    cta: string;
    unsub: string;
  }
> = {
  fr: {
    subject: (p) => `${p} vous propose une réduction`,
    hello: (n) => `Bonjour ${n},`,
    body: (p, s, pct) =>
      `<strong>${p}</strong> vient de mettre en ligne <strong>−${pct} %</strong> sur « ${s} ».`,
    until: (d) => `Offre valable jusqu'au ${d}.`,
    cta: 'Réserver maintenant',
    unsub: 'Ne plus recevoir les promotions de ce prestataire',
  },
  en: {
    subject: (p) => `${p} has a discount for you`,
    hello: (n) => `Hi ${n},`,
    body: (p, s, pct) => `<strong>${p}</strong> just launched <strong>−${pct}%</strong> on “${s}”.`,
    until: (d) => `Offer valid until ${d}.`,
    cta: 'Book now',
    unsub: 'Stop receiving promotions from this provider',
  },
  it: {
    subject: (p) => `${p} ha uno sconto per te`,
    hello: (n) => `Ciao ${n},`,
    body: (p, s, pct) =>
      `<strong>${p}</strong> ha appena lanciato <strong>−${pct}%</strong> su «${s}».`,
    until: (d) => `Offerta valida fino al ${d}.`,
    cta: 'Prenota ora',
    unsub: 'Non ricevere più le promozioni di questo professionista',
  },
  pt: {
    subject: (p) => `${p} tem um desconto para si`,
    hello: (n) => `Olá ${n},`,
    body: (p, s, pct) =>
      `<strong>${p}</strong> acaba de lançar <strong>−${pct}%</strong> em «${s}».`,
    until: (d) => `Oferta válida até ${d}.`,
    cta: 'Marcar agora',
    unsub: 'Deixar de receber as promoções deste profissional',
  },
};

const resolveLocale = (raw: unknown): Locale =>
  raw === 'en' || raw === 'it' || raw === 'pt' ? raw : 'fr';

const INTL_LOCALE: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  it: 'it-IT',
  pt: 'pt-PT',
};

export type PromoRunOutcome =
  | 'no-promo'
  | 'not-requested'
  | 'not-active'
  | 'already-sent'
  | 'provider-missing'
  | 'provider-ineligible'
  | 'throttled'
  | 'no-recipients'
  | 'claimed-by-other'
  | 'failed'
  | 'partial'
  | 'sent';

/**
 * Traite une prestation. Sûr à rejouer : une offre déjà traitée — succès,
 * échec partiel ou total — n'est jamais retraitée.
 */
export async function runPromoEmailForService(
  providerId: string,
  serviceId: string,
  service: FirebaseFirestore.DocumentData,
  now: Date = new Date(),
): Promise<PromoRunOutcome> {
  const discount = service.discount as PromoNotificationInput | null | undefined;

  const db = admin.firestore();
  const providerRef = db.collection('providers').doc(providerId);
  const ledgerRef = providerRef.collection('promoNotifications').doc(serviceId);

  // Registre : cette offre a-t-elle déjà été TRAITÉE ? La présence de la
  // signature suffit — un échec partiel ou total ne rouvre rien.
  const ledgerSnap = await ledgerRef.get();
  const ledger = ledgerSnap.exists ? ledgerSnap.data()! : null;
  const settledSignature = (ledger?.signature as string | undefined) ?? null;

  const decision = decidePromoNotification(
    discount ? { ...discount, notifiedSignature: settledSignature } : discount,
    localToday(now),
  );
  if (!decision.send) {
    return decision.reason;
  }

  // Étape 2 — le prestataire est-il TOUJOURS en droit d'envoyer ? Le cron
  // peut passer des semaines après la mise en ligne de l'offre : entre
  // temps l'abonnement a pu expirer, la fiche être dépubliée ou la carte
  // de fidélité désactivée. On revérifie, on ne se fie pas à l'état du
  // jour où la promo a été créée.
  const providerSnap = await providerRef.get();
  if (!providerSnap.exists) return 'provider-missing';
  const provider = providerSnap.data()!;
  if (
    provider.isPublished !== true ||
    !isLoyaltyConfigValidMirror(provider.settings?.loyalty) ||
    !hasLoyaltyAccessMirror(provider)
  ) {
    return 'provider-ineligible';
  }

  // Étape 3 — lecture seule du throttle. On sort SANS rien écrire.
  const lastSentAt =
    (provider.lastPromoEmailAt as admin.firestore.Timestamp | undefined)?.toMillis?.() ?? 0;
  if (now.getTime() - lastSentAt < THROTTLE_MS) return 'throttled';

  // Étape 4 — destinataires. Opt-in explicite requis (RGPD : jamais de
  // consentement implicite). Filtre en mémoire : volumes faibles par pro,
  // pas d'index composite à maintenir.
  const clientsSnap = await db
    .collection('providerClients')
    .where('providerId', '==', providerId)
    .get();
  const eligible = clientsSnap.docs.filter((d) => {
    const c = d.data();
    return c.promoEmailsOptIn === true && !!c.email && !c.demoSeed;
  });
  // Un client inscrit peut avoir plusieurs fiches chez le même pro (une par
  // adresse de réservation). Une carte = un client = UN email : on ne garde
  // qu'une fiche par `clientId`. Les fiches sans compte (résas invités)
  // restent traitées individuellement, elles n'ont pas d'UID pour les
  // regrouper.
  const seenClientIds = new Set<string>();
  const recipients = eligible.filter((d) => {
    const uid = d.data().clientId as string | undefined;
    if (!uid) return true;
    if (seenClientIds.has(uid)) return false;
    seenClientIds.add(uid);
    return true;
  });
  if (recipients.length === 0) return 'no-recipients';

  // Étape 5 — réservation atomique. Relit throttle ET registre : si une
  // exécution concurrente est passée entre-temps, on abandonne.
  const claimedAt = admin.firestore.Timestamp.now();
  const claimed = await db.runTransaction(async (tx) => {
    const [pSnap, lSnap] = await Promise.all([tx.get(providerRef), tx.get(ledgerRef)]);
    if (!pSnap.exists) return false;

    const last =
      (pSnap.data()!.lastPromoEmailAt as admin.firestore.Timestamp | undefined)?.toMillis?.() ?? 0;
    if (now.getTime() - last < THROTTLE_MS) return false;

    const l = lSnap.exists ? lSnap.data()! : null;
    if (l && l.signature === decision.signature) return false;

    tx.update(providerRef, { lastPromoEmailAt: claimedAt });
    tx.set(ledgerRef, {
      signature: decision.signature,
      serviceId,
      // Contexte figé de l'offre au moment de l'envoi : la vue admin doit
      // pouvoir afficher CE qui est parti, même si le pro a modifié sa
      // promo depuis.
      serviceName: (service.name as string) ?? '',
      percent: discount!.percent ?? 0,
      startsAt: discount!.startsAt ?? null,
      endsAt: discount!.endsAt ?? null,
      // 'pending' tant que la boucle d'envoi n'a rien conclu. Cet état
      // subsiste si la function meurt en plein vol : c'est un incident
      // à constater dans la vue admin, pas un déclencheur de reprise.
      status: 'pending',
      claimedAt,
      attempts: admin.firestore.FieldValue.increment(1),
      recipientsCount: recipients.length,
      sentTo: [],
      sentCount: 0,
      failedCount: 0,
      sentAt: null,
      lastError: null,
    });
    return true;
  });
  if (!claimed) return 'claimed-by-other';

  const businessName = (provider.businessName as string) ?? '';
  const slug = (provider.slug as string) ?? null;
  const serviceName = (service.name as string) ?? '';
  const percent = discount!.percent!;
  const bookUrl = slug ? `${APP_URL}/p/${slug}` : APP_URL;

  // Qui a effectivement été servi — pour que la vue admin distingue un
  // envoi complet d'un envoi partiel.
  const servedNow: string[] = [];
  let lastError: string | null = null;
  for (const doc of recipients) {
    const c = doc.data();
    // Token de désinscription par fiche — créé paresseusement.
    let token = c.promoUnsubToken as string | undefined;
    if (!token) {
      token = randomBytes(24).toString('hex');
      await doc.ref.update({ promoUnsubToken: token });
    }
    const l = resolveLocale(c.clientLocale);
    const t = TEXTS[l];
    const endsAtLabel = discount!.endsAt
      ? new Date(`${discount!.endsAt}T12:00:00`).toLocaleDateString(INTL_LOCALE[l], {
          day: 'numeric',
          month: 'long',
        })
      : null;
    const unsubUrl = `${APP_URL}/api/loyalty/promo-unsubscribe?d=${encodeURIComponent(doc.id)}&t=${token}`;
    const html = `
        <p style="font-size:16px;color:#111827;">${t.hello((c.name as string) || '')}</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;">${t.body(businessName, serviceName, percent)}</p>
        ${endsAtLabel ? `<p style="font-size:14px;color:#b45309;font-weight:600;">${t.until(endsAtLabel)}</p>` : ''}
        <p style="margin:24px 0;"><a href="${bookUrl}" style="background:#1a6daf;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;">${t.cta}</a></p>
        <p style="font-size:12px;color:#9ca3af;margin-top:28px;"><a href="${unsubUrl}" style="color:#9ca3af;">${t.unsub}</a></p>
      `;
    try {
      await sendRawEmail({ to: c.email as string, subject: t.subject(businessName), html });
      servedNow.push(doc.id);
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      console.error(`[promoEmail] envoi échoué pour ${doc.id}:`, e);
    }
  }

  const sent = servedNow.length;
  const failed = recipients.length - sent;
  const status = sent === recipients.length ? 'sent' : sent > 0 ? 'partial' : 'failed';

  // Clôture du registre. Aucune reprise n'en découle : ces champs servent
  // uniquement à constater ce qui s'est passé depuis la vue admin.
  await ledgerRef.set(
    {
      status,
      sentTo: servedNow,
      sentCount: sent,
      failedCount: failed,
      sentAt: admin.firestore.Timestamp.now(),
      lastError: failed > 0 ? lastError : null,
    },
    { merge: true },
  );

  console.log(
    `[promoEmail] ${providerId}/${serviceId}: ${sent}/${recipients.length} emails envoyés (${serviceName} −${percent}%)`,
  );
  return status;
}
