import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { serverTracker } from '../utils/serverTracker';
import { providerTimeZone } from '../lib/morningAgenda';
import { jourLocal, ajouterJours } from '../lib/fuseaux';
import { providerLocale, INTL_LOCALE } from '../lib/providerPushI18n';
import type { HoraireDateLu } from '../lib/horairesEnVigueur';
import {
  momentDuRappel,
  lundiSuivant,
  semaineVide,
  cleDuRappel,
  jourLisible,
  TEXTES_RAPPEL,
  type MomentDuRappel,
} from '../lib/rappelPlanning';
import { sendPushNotifications } from '../utils/expoPushService';
import { getUserPushTokens, removeInvalidTokens, loadProviderPushContext } from '../notifications/bookingNotifications';

/**
 * Rappel « votre semaine prochaine est vide » — membres en HORAIRES
 * VARIABLES uniquement (voir `lib/rappelPlanning.ts` pour les règles).
 *
 * Le jeudi à 18 h, puis le dimanche à 18 h si c'est toujours vide, à l'heure
 * DU LIEU du membre : la tâche tourne toutes les heures les jours concernés
 * (jeudi, vendredi, dimanche et lundi, heure de Paris, pour couvrir les
 * fuseaux servis) et n'agit que là où il est 18 h.
 *
 * Le membre reçoit une notification (s'il a un accès à l'app) ; le gérant un
 * récapitulatif par salon. Un marqueur `planningReminders/{id}` par
 * destinataire, semaine et moment garantit un seul envoi.
 */
export const sendPlanningReminders = onSchedule(
  {
    schedule: '0 * * * 0,1,4,5',
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
  },
  async () => {
    serverTracker.startContext('sendPlanningReminders');
    try {
      const bilan = await envoyerRappelsPlanning(new Date());
      console.log(
        `=== sendPlanningReminders : ${bilan.membres.length} membre(s), ${bilan.gerants.length} gérant(s) ===`,
      );
    } finally {
      serverTracker.endContext();
    }
  },
);

export interface BilanRappels {
  membres: { providerId: string; memberId: string; lundi: string; moment: MomentDuRappel; envoye: boolean }[];
  gerants: { providerId: string; lundi: string; moment: MomentDuRappel; noms: string[]; envoye: boolean }[];
}

/** Le travail, séparé du planificateur : rejouable sur l'émulateur avec un « maintenant » choisi. */
export async function envoyerRappelsPlanning(maintenant: Date): Promise<BilanRappels> {
  const db = admin.firestore();
  const bilan: BilanRappels = { membres: [], gerants: [] };

  // Tous les membres de la plateforme, en une lecture : sans filtre, aucun
  // index de groupe de collections n'est nécessaire, et la tâche ne tourne
  // que quatre jours par semaine.
  const membresSnap = await db.collectionGroup('members').get();
  serverTracker.trackRead('providers/*/members', membresSnap.size);

  const parSalon = new Map<string, { id: string; name: string; locationId?: string }[]>();
  for (const d of membresSnap.docs) {
    const m = d.data();
    if (m.variableHours !== true || m.isActive === false || m.demoSeed) continue;
    const providerId = d.ref.parent.parent?.id;
    if (!providerId) continue;
    parSalon.set(providerId, [...(parSalon.get(providerId) ?? []), { id: d.id, name: String(m.name ?? ''), locationId: m.locationId }]);
  }

  for (const [providerId, membres] of parSalon) {
    try {
      const refProvider = db.collection('providers').doc(providerId);
      const providerDoc = await refProvider.get();
      serverTracker.trackRead('providers', 1);
      const p = providerDoc.data();
      if (!providerDoc.exists || !p || p.demoSeed) continue;

      const lieux = await refProvider.collection('locations').get();
      serverTracker.trackRead('providers/*/locations', lieux.size);
      const fuseauDuLieu = new Map(lieux.docs.map((l) => [l.id, (l.data().timezone as string | undefined) ?? null]));

      const locale = providerLocale(p);
      const textes = TEXTES_RAPPEL[locale];
      const intl = INTL_LOCALE[locale];

      // Horaires datés, lus une fois par (salon, semaine visée).
      const datesParLundi = new Map<string, (HoraireDateLu & { memberId: string })[]>();
      const datesDe = async (lundi: string) => {
        const deja = datesParLundi.get(lundi);
        if (deja) return deja;
        const snap = await refProvider.collection('datedAvailability').where('to', '>=', lundi).get();
        serverTracker.trackRead('providers/*/datedAvailability', snap.size);
        const dates = snap.docs.map((d) => {
          const r = d.data();
          return {
            memberId: r.memberId,
            from: r.from,
            to: r.to,
            weekdays: Array.isArray(r.weekdays) ? r.weekdays : [],
            mode: r.mode,
            slots: Array.isArray(r.slots) ? r.slots : [],
            createdAt: r.createdAt?.toDate?.() ?? null,
          };
        });
        datesParLundi.set(lundi, dates);
        return dates;
      };

      // Qui a une semaine vide, regroupé par (semaine, moment) pour le gérant.
      const videsPourGerant = new Map<string, { lundi: string; moment: MomentDuRappel; membres: typeof membres }>();

      for (const m of membres) {
        const fuseau = providerTimeZone(p.countryCode, m.locationId ? fuseauDuLieu.get(m.locationId) : null);
        const moment = momentDuRappel(maintenant, fuseau);
        if (!moment) continue;
        const lundi = lundiSuivant(jourLocal(maintenant, fuseau));
        const dates = (await datesDe(lundi)).filter((d) => d.memberId === m.id);
        if (!semaineVide(dates, lundi)) continue;

        const cleGroupe = `${lundi}_${moment}`;
        const groupe = videsPourGerant.get(cleGroupe) ?? { lundi, moment, membres: [] };
        groupe.membres.push(m);
        videsPourGerant.set(cleGroupe, groupe);

        // Le membre — une fois par semaine visée et par moment.
        const marqueur = db.collection('planningReminders').doc(cleDuRappel(providerId, m.id, lundi, moment));
        if ((await marqueur.get()).exists) continue;
        let envoye = false;
        const compte = await db
          .collection('memberAccounts')
          .where('providerId', '==', providerId)
          .where('memberId', '==', m.id)
          .where('active', '==', true)
          .limit(1)
          .get();
        const uid = compte.docs[0]?.id;
        if (uid) {
          const jetons = await getUserPushTokens(uid);
          if (jetons.length > 0) {
            const resultat = await sendPushNotifications(jetons, {
              title: textes.membreTitre(jourLisible(lundi, intl), moment === 'dimanche'),
              body: textes.membreCorps(jourLisible(lundi, intl), jourLisible(ajouterJours(lundi, 6), intl)),
              data: { type: 'planning_semaine_vide', memberId: m.id, lundi },
            });
            envoye = resultat.sentCount > 0;
            if (resultat.invalidTokens.length > 0) await removeInvalidTokens(uid, resultat.invalidTokens);
          }
        }
        await marqueur.set({ providerId, memberId: m.id, lundi, moment, envoye, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        bilan.membres.push({ providerId, memberId: m.id, lundi, moment, envoye });
      }

      // Le gérant — un récapitulatif par semaine visée et par moment.
      for (const { lundi, moment, membres: vides } of videsPourGerant.values()) {
        const marqueur = db.collection('planningReminders').doc(cleDuRappel(providerId, 'gerant', lundi, moment));
        if ((await marqueur.get()).exists) continue;
        const noms = vides.map((m) => m.name).filter(Boolean);
        let envoye = false;
        const ctx = await loadProviderPushContext(providerId);
        if (ctx && ctx.allowed('planning')) {
          const jetons = await getUserPushTokens(ctx.userId);
          if (jetons.length > 0) {
            const resultat = await sendPushNotifications(jetons, {
              title: textes.gerantTitre(vides.length, jourLisible(lundi, intl)),
              body: textes.gerantCorps(noms.join(', ')),
              data: { type: 'planning_semaine_vide', memberId: vides[0].id, lundi },
            });
            envoye = resultat.sentCount > 0;
            if (resultat.invalidTokens.length > 0) await removeInvalidTokens(ctx.userId, resultat.invalidTokens);
          }
        }
        await marqueur.set({ providerId, memberId: null, lundi, moment, noms, envoye, createdAt: admin.firestore.FieldValue.serverTimestamp() });
        bilan.gerants.push({ providerId, lundi, moment, noms, envoye });
      }
    } catch (err) {
      // Un salon en erreur ne prive pas les autres de leur rappel.
      console.error(`sendPlanningReminders — salon ${providerId} :`, err);
    }
  }

  return bilan;
}
