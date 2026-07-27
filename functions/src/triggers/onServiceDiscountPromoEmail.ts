/**
 * onServiceDiscountPromoEmail — fidélité v2 M3.
 *
 * Quand un pro met en ligne une promo sur une prestation (champ `discount`
 * apparaît ou change), email aux clients qui ont ACTIVÉ leur carte ET coché
 * l'opt-in promos (promoEmailsOptIn) chez ce prestataire.
 *
 * Garde-fous :
 *  - throttle : jamais plus d'un email promo par prestataire par 7 jours
 *    (champ provider.lastPromoEmailAt, posé transactionnellement) ;
 *  - promo réellement active (fenêtre de dates) ;
 *  - lien de désinscription obligatoire (RGPD) : token aléatoire par fiche
 *    client (promoUnsubToken, généré au premier envoi), route publique
 *    /api/loyalty/promo-unsubscribe côté web.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import { sendRawEmail } from '../utils/resendService';

const THROTTLE_MS = 7 * 24 * 60 * 60 * 1000;
const APP_URL = 'https://opatam.com';

type Locale = 'fr' | 'en' | 'it' | 'pt';
const TEXTS: Record<Locale, {
  subject: (p: string) => string;
  hello: (n: string) => string;
  body: (p: string, s: string, pct: number) => string;
  until: (d: string) => string;
  cta: string;
  unsub: string;
}> = {
  fr: {
    subject: (p) => `${p} vous propose une réduction`,
    hello: (n) => `Bonjour ${n},`,
    body: (p, s, pct) => `<strong>${p}</strong> vient de mettre en ligne <strong>−${pct} %</strong> sur « ${s} ».`,
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
    body: (p, s, pct) => `<strong>${p}</strong> ha appena lanciato <strong>−${pct}%</strong> su «${s}».`,
    until: (d) => `Offerta valida fino al ${d}.`,
    cta: 'Prenota ora',
    unsub: 'Non ricevere più le promozioni di questo professionista',
  },
  pt: {
    subject: (p) => `${p} tem um desconto para si`,
    hello: (n) => `Olá ${n},`,
    body: (p, s, pct) => `<strong>${p}</strong> acaba de lançar <strong>−${pct}%</strong> em «${s}».`,
    until: (d) => `Oferta válida até ${d}.`,
    cta: 'Marcar agora',
    unsub: 'Deixar de receber as promoções deste profissional',
  },
};
const resolveLocale = (raw: unknown): Locale =>
  raw === 'en' || raw === 'it' || raw === 'pt' ? raw : 'fr';

export const onServiceDiscountPromoEmail = onDocumentWritten(
  {
    document: 'providers/{providerId}/services/{serviceId}',
    region: 'europe-west1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return; // suppression de presta

    const discount = after.discount as
      | { percent?: number; startsAt?: string | null; endsAt?: string | null }
      | null
      | undefined;
    if (!discount?.percent) return;

    // Nouvelle promo = discount apparu OU % / échéance modifiés.
    const prev = before?.discount as typeof discount;
    const isNew =
      !prev?.percent || prev.percent !== discount.percent || prev.endsAt !== discount.endsAt;
    if (!isNew) return;

    // Promo réellement active aujourd'hui (fenêtre de dates locale).
    const today = new Date().toISOString().slice(0, 10);
    if (discount.startsAt && discount.startsAt > today) return;
    if (discount.endsAt && discount.endsAt < today) return;

    const providerId = event.params.providerId;
    const db = admin.firestore();

    // Throttle transactionnel : un seul envoi par fenêtre de 7 jours, même
    // si le pro retouche plusieurs promos dans la foulée.
    const providerRef = db.collection('providers').doc(providerId);
    const allowed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(providerRef);
      if (!snap.exists) return null;
      const p = snap.data()!;
      const last = (p.lastPromoEmailAt as admin.firestore.Timestamp | undefined)?.toMillis?.() ?? 0;
      if (Date.now() - last < THROTTLE_MS) return null;
      tx.update(providerRef, { lastPromoEmailAt: admin.firestore.Timestamp.now() });
      return { businessName: (p.businessName as string) ?? '', slug: (p.slug as string) ?? null };
    });
    if (!allowed) {
      console.log(`[promoEmail] ${providerId}: throttle 7j actif ou provider absent — skip`);
      return;
    }

    // Destinataires : carte activée + opt-in + email. (Filtre en mémoire —
    // pas d'index composite nécessaire, volumes faibles par pro.)
    const clientsSnap = await db
      .collection('providerClients')
      .where('providerId', '==', providerId)
      .get();
    const recipients = clientsSnap.docs.filter((d) => {
      const c = d.data();
      // opt-in explicite requis (jamais de consentement implicite, RGPD)
      return c.promoEmailsOptIn === true && !!c.email && !c.demoSeed;
    });
    if (recipients.length === 0) {
      console.log(`[promoEmail] ${providerId}: aucun destinataire opt-in`);
      return;
    }

    const serviceName = (after.name as string) ?? '';
    const bookUrl = allowed.slug ? `${APP_URL}/p/${allowed.slug}` : APP_URL;

    let sent = 0;
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
      const endsAtLabel = discount.endsAt
        ? new Date(`${discount.endsAt}T12:00:00`).toLocaleDateString(
            l === 'en' ? 'en-GB' : l === 'it' ? 'it-IT' : l === 'pt' ? 'pt-PT' : 'fr-FR',
            { day: 'numeric', month: 'long' },
          )
        : null;
      const unsubUrl = `${APP_URL}/api/loyalty/promo-unsubscribe?d=${encodeURIComponent(doc.id)}&t=${token}`;
      const html = `
        <p style="font-size:16px;color:#111827;">${t.hello((c.name as string) || '')}</p>
        <p style="font-size:15px;color:#374151;line-height:1.6;">${t.body(allowed.businessName, serviceName, discount.percent)}</p>
        ${endsAtLabel ? `<p style="font-size:14px;color:#b45309;font-weight:600;">${t.until(endsAtLabel)}</p>` : ''}
        <p style="margin:24px 0;"><a href="${bookUrl}" style="background:#1a6daf;color:#fff;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;">${t.cta}</a></p>
        <p style="font-size:12px;color:#9ca3af;margin-top:28px;"><a href="${unsubUrl}" style="color:#9ca3af;">${t.unsub}</a></p>
      `;
      try {
        await sendRawEmail({ to: c.email as string, subject: t.subject(allowed.businessName), html });
        sent++;
      } catch (e) {
        console.error(`[promoEmail] envoi échoué pour ${doc.id}:`, e);
      }
    }
    console.log(`[promoEmail] ${providerId}: ${sent}/${recipients.length} emails envoyés (${serviceName} −${discount.percent}%)`);
  },
);
