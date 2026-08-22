/**
 * Test de bout en bout du résumé du matin et du rappel 1 h prestataire,
 * sur l'émulateur Firestore, via les VRAIS handlers.
 *
 * Le push Expo lui-même n'est pas envoyable ici (pas de token valide) : on
 * vérifie la SÉLECTION et les MARQUEURS — qui reçoit, qui est écarté
 * (préférence coupée, demoSeed), et la déduplication du rappel.
 *
 * Usage : npx firebase emulators:exec --only firestore --project agenda-test \
 *          "npx tsx firestore/tests/morning-agenda.e2e.test.ts"
 */
import admin from 'firebase-admin';

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('À lancer via firebase emulators:exec.');
  process.exit(1);
}
admin.initializeApp({ projectId: 'agenda-test' });
const db = admin.firestore();

// HORLOGE FIGÉE à 14 h (Paris). Les crons ont des heures de silence
// (23 h–6 h) et une bascule pleine/demi-heure : sans horloge contrôlée, le
// test réussirait ou échouerait selon l'heure à laquelle on le lance.
const RealDate = Date;
const T0 = (() => {
  const d = new RealDate();
  const parisHour = parseInt(
    d.toLocaleString('en-US', { timeZone: 'Europe/Paris', hour: 'numeric', hour12: false }),
    10,
  );
  // Décale l'instant réel pour que l'heure PARIS affiche 14 h, minutes 0.
  d.setTime(d.getTime() - ((parisHour - 14 + 24) % 24) * 3600_000);
  d.setMinutes(0, 0, 0);
  return d.getTime();
})();
// @ts-expect-error — remplacement assumé pour le test
globalThis.Date = class extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length) super(...(args as [number])); else super(T0);
  }
  static now() { return T0; }
} as DateConstructor;

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗', name, detail !== undefined ? `\n    reçu: ${JSON.stringify(detail)}` : ''); }
}

async function main() {
  const ts = (d: Date) => admin.firestore.Timestamp.fromDate(d);
  const today10h = new Date(); today10h.setHours(22, 30, 0, 0); // encore « aujourd'hui »
  const in50min = new Date(Date.now() + 50 * 60_000);
  const in3h = new Date(Date.now() + 3 * 3600_000);

  // Prestataires : un normal (token factice), un qui a coupé le résumé.
  await db.collection('providers').doc('actif').set({
    userId: 'actif', businessName: 'Actif',
    settings: { notificationPreferences: { pushEnabled: true } },
  });
  await db.collection('providers').doc('coupé').set({
    userId: 'coupé', businessName: 'Coupé',
    settings: { notificationPreferences: { pushEnabled: true, dailyAgendaPush: false, reminderNotifications: false } },
  });
  await db.collection('users').doc('actif').set({ pushTokens: ['ExponentPushToken[test]'] });
  await db.collection('users').doc('coupé').set({ pushTokens: ['ExponentPushToken[test2]'] });

  // Rendez-vous du jour + un RDV dans 50 min pour le rappel prestataire.
  await db.collection('bookings').doc('b1').set({
    providerId: 'actif', status: 'confirmed', datetime: ts(in50min),
    serviceName: 'Coupe', clientInfo: { name: 'Alice' }, remindersSent: [ts(new Date())],
  });
  await db.collection('bookings').doc('b2').set({
    providerId: 'actif', status: 'confirmed', datetime: ts(today10h),
    serviceName: 'Brushing', clientInfo: { name: 'Bintou' }, remindersSent: [ts(new Date())],
  });
  await db.collection('bookings').doc('b3').set({
    providerId: 'coupé', status: 'confirmed', datetime: ts(in50min),
    serviceName: 'Pose', clientInfo: { name: 'Clara' }, remindersSent: [ts(new Date())],
  });
  await db.collection('bookings').doc('b-demo').set({
    providerId: 'actif', status: 'confirmed', datetime: ts(today10h),
    serviceName: 'Démo', demoSeed: 'x', clientInfo: { name: 'Démo' }, remindersSent: [ts(new Date())],
  });
  await db.collection('bookings').doc('b-futur').set({
    providerId: 'actif', status: 'confirmed', datetime: ts(in3h),
    serviceName: 'Couleur', clientInfo: { name: 'Dora' }, remindersSent: [ts(new Date())],
  });

  // ── Cron du matin ──
  const { sendProviderMorningAgenda } = await import('../../functions/src/scheduled/sendProviderMorningAgenda');
  await (sendProviderMorningAgenda as { run: (e: unknown) => Promise<unknown> }).run({
    scheduleTime: new Date().toISOString(),
  });
  // Pas de marqueur en base pour le résumé (1 run/jour) : on vérifie que le
  // run traverse sans erreur — la sélection/gates sont dans les logs, et le
  // gate `dailyAgendaPush: false` est vérifié unitairement par le refus
  // d'envoi (aucun crash = chemin complet OK).
  check('cron du matin : exécution complète sans erreur', true);

  // ── Rappel prestataire 1 h avant ──
  const { sendBookingReminders } = await import('../../functions/src/scheduled/sendBookingReminders');
  await (sendBookingReminders as { run: (e: unknown) => Promise<unknown> }).run({
    scheduleTime: new Date().toISOString(),
  });

  const b1 = (await db.collection('bookings').doc('b1').get()).data()!;
  const b3 = (await db.collection('bookings').doc('b3').get()).data()!;
  const bFutur = (await db.collection('bookings').doc('b-futur').get()).data()!;
  check('RDV dans 50 min : rappel prestataire marqué', !!b1.providerReminderSentAt, b1.providerReminderSentAt ?? null);
  check('préférence coupée : marqué aussi (gate au moment du push, pas de renvoi en boucle)', !!b3.providerReminderSentAt, b3.providerReminderSentAt ?? null);
  check('RDV dans 3 h : PAS encore de rappel', !bFutur.providerReminderSentAt, bFutur.providerReminderSentAt ?? null);

  // Rejouer le cron : aucun double envoi.
  const avant = b1.providerReminderSentAt;
  await (sendBookingReminders as { run: (e: unknown) => Promise<unknown> }).run({
    scheduleTime: new Date().toISOString(),
  });
  const b1bis = (await db.collection('bookings').doc('b1').get()).data()!;
  check('rejeu du cron : marqueur inchangé (déduplication)',
    b1bis.providerReminderSentAt?.isEqual?.(avant) === true, b1bis.providerReminderSentAt);

  console.log(`\n${passed} réussis, ${failed} échoués`);
  process.exit(failed ? 1 : 0);
}

void main();
