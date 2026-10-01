/**
 * Le gérant est prévenu quand un MEMBRE modifie son planning (décision du
 * 2026-09-29 : horaires libres, gérant notifié) — en UNE notification
 * regroupée, pas une par clic.
 *
 * 1. Chaque écriture d'horaires, d'horaires datés ou d'indisponibilité faite
 *    par un compte membre (`memberAccounts/{authId}` actif, pour ce salon)
 *    incrémente `planningChanges/{salon}_{membre}`. Le gérant, l'admin et
 *    les traitements serveur ne comptent pas.
 * 2. Toutes les 5 minutes, chaque regroupement resté calme 10 minutes part
 *    en une notification au gérant, puis est effacé.
 */
import { onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { TEXTES_MEMBRE } from '../lib/notificationsMembre';
import { sendPushNotifications } from '../utils/expoPushService';
import { getUserPushTokens, removeInvalidTokens, loadProviderPushContext } from '../notifications/bookingNotifications';

/** Délai de calme avant d'envoyer le récapitulatif. */
export const CALME_MS = 10 * 60_000;

/** Note un changement si l'auteur est un membre de CE salon. Rend `true` si noté. */
export async function noterChangementPlanning(p: {
  providerId: string;
  authId: string | null | undefined;
  memberId: string | null | undefined;
}): Promise<boolean> {
  const { providerId, authId, memberId } = p;
  if (!authId || !memberId || authId === providerId) return false;
  const db = admin.firestore();
  const compte = (await db.collection('memberAccounts').doc(authId).get()).data();
  if (!compte || compte.active !== true || compte.providerId !== providerId || compte.memberId !== memberId) return false;
  const ref = db.collection('planningChanges').doc(`${providerId}_${memberId}`);
  await ref.set(
    { providerId, memberId, count: FieldValue.increment(1), lastAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return true;
}

const surEcriture = (collection: string) =>
  onDocumentWrittenWithAuthContext(
    { document: `providers/{providerId}/${collection}/{docId}`, region: 'europe-west1' },
    async (event) => {
      const avant = event.data?.before?.data();
      const apres = event.data?.after?.data();
      if ((apres ?? avant)?.demoSeed) return;
      try {
        await noterChangementPlanning({
          providerId: event.params.providerId,
          authId: event.authId,
          memberId: (apres?.memberId ?? avant?.memberId) as string | undefined,
        });
      } catch (err) {
        console.error(`[planningChange] ${collection} :`, err);
      }
    },
  );

export const onAvailabilityWriteByMember = surEcriture('availability');
export const onDatedAvailabilityWriteByMember = surEcriture('datedAvailability');
export const onBlockedSlotWriteByMember = surEcriture('blockedSlots');

export interface BilanRecaps {
  envoyes: { providerId: string; memberId: string; count: number; envoye: boolean }[];
}

/** Envoie les récapitulatifs restés calmes depuis `CALME_MS`. Rejouable sur l'émulateur. */
export async function envoyerRecapsPlanning(maintenant: Date): Promise<BilanRecaps> {
  const db = admin.firestore();
  const bilan: BilanRecaps = { envoyes: [] };
  const snap = await db
    .collection('planningChanges')
    .where('lastAt', '<=', Timestamp.fromMillis(maintenant.getTime() - CALME_MS))
    .get();
  for (const doc of snap.docs) {
    const { providerId, memberId, count } = doc.data() as { providerId: string; memberId: string; count: number };
    let envoye = false;
    try {
      const ctx = await loadProviderPushContext(providerId);
      if (ctx && ctx.allowed('planningChanges')) {
        const jetons = await getUserPushTokens(ctx.userId);
        if (jetons.length > 0) {
          const membre = (await db.collection('providers').doc(providerId).collection('members').doc(memberId).get()).data();
          const t = TEXTES_MEMBRE[ctx.locale];
          const resultat = await sendPushNotifications(jetons, {
            title: t.planningModifie(String(membre?.name ?? '')),
            body: t.planningModifieCorps(count),
            data: { type: 'planning_modifie', memberId },
          });
          envoye = resultat.sentCount > 0;
          if (resultat.invalidTokens.length > 0) await removeInvalidTokens(ctx.userId, resultat.invalidTokens);
        }
      }
    } catch (err) {
      console.error(`[planningChange] récapitulatif ${providerId}/${memberId} :`, err);
    }
    // Envoyé ou non (gérant sans jeton, interrupteur coupé), le regroupement
    // est soldé : on ne relance pas le même lot à chaque passage.
    await doc.ref.delete();
    bilan.envoyes.push({ providerId, memberId, count, envoye });
  }
  return bilan;
}

export const sendPlanningChangeDigests = onSchedule(
  { schedule: 'every 5 minutes', timeZone: 'Europe/Paris', region: 'europe-west1' },
  async () => {
    const bilan = await envoyerRecapsPlanning(new Date());
    if (bilan.envoyes.length > 0) console.log(`[planningChange] ${bilan.envoyes.length} récapitulatif(s)`);
  },
);
