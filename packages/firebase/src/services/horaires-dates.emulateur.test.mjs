/**
 * Horaires datés — le service (`schedulingService`), tel quel, contre
 * l'ÉMULATEUR Firestore : planning jour par jour, et rendez-vous qu'un
 * changement laisserait hors horaires (aperçus, sans écriture — les
 * écritures sont couvertes par les tests de règles).
 *
 * Exécution : ./firestore/run-rules-test.sh (émulateur, projet jetable).
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, register } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = resolve(ici, '../../../..');

// Metro et Next importent sans extension ; `node --test` non.
register('data:text/javascript,' + encodeURIComponent(`
  const SHARED = ${JSON.stringify(pathToFileURL(resolve(racine, 'packages/shared/src/index.ts')).href)};
  export async function resolve(specifier, context, next) {
    if (specifier === '@booking-app/shared') return next(SHARED, context);
    try { return await next(specifier, context); }
    catch (e) {
      const relatif = specifier.startsWith('.') || specifier.startsWith('file:');
      if (!relatif || /\\.[cm]?[jt]s$/.test(specifier)) throw e;
      try { return await next(specifier + '.ts', context); }
      catch { return next(specifier + '/index.ts', context); }
    }
  }
`));

if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Ce test ne tourne que sur l’émulateur.');
const projet = process.env.GCLOUD_PROJECT || 'opatam-rules-test';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projet;
process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||= 'cle-de-test';

const req = createRequire(resolve(racine, 'apps/web/package.json'));
const { initializeApp, getApps } = req('firebase-admin/app');
if (!getApps().length) initializeApp({ projectId: projet });
const { getFirestore, Timestamp } = req('firebase-admin/firestore');
const admin = getFirestore();

const { schedulingService } = await import(pathToFileURL(resolve(racine, 'packages/firebase/src/index.ts')).href);
const { ajouterJours, jourLocal, instantDepuisHeureLocale } = await import(pathToFileURL(resolve(racine, 'packages/shared/src/index.ts')).href);

const PID = 'pro-test-horaires-dates';
const FUSEAU = 'Europe/Paris';
const p = admin.doc(`providers/${PID}`);

// Une semaine bien dans le futur : lundi dans ~3 semaines.
const aujourdhui = jourLocal(new Date(), FUSEAU);
const decalage = (8 - new Date(`${aujourdhui}T12:00:00Z`).getUTCDay()) % 7 || 7;
const LUNDI = ajouterJours(aujourdhui, decalage + 14);
const jourN = (n) => ajouterJours(LUNDI, n); // 0 = lundi … 6 = dimanche
const a = (jour, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return instantDepuisHeureLocale(jour, h * 60 + m, FUSEAU);
};

async function vider() {
  for (const c of ['members', 'availability', 'locations', 'datedAvailability']) {
    const s = await p.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  const rdvs = await admin.collection('bookings').where('providerId', '==', PID).get();
  await Promise.all(rdvs.docs.map((d) => d.ref.delete()));
}

async function semaineType() {
  // Lundi → vendredi 9h–18h, week-end fermé.
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    const ouvert = d >= 1 && d <= 5;
    await p.collection('availability').doc(`m1_${d}`).set({
      memberId: 'm1', locationId: 'lieu-1', dayOfWeek: d, isOpen: ouvert,
      slots: ouvert ? [{ start: '09:00', end: '18:00' }] : [], effectiveFrom: null,
    });
  }
}

let n = 0;
const dater = async (r) => {
  n += 1;
  const ref = await p.collection('datedAvailability').add({
    memberId: 'm1', locationId: 'lieu-1', weekdays: [], slots: [],
    createdAt: Timestamp.fromMillis(Date.now() + n), ...r,
  });
  return ref.id;
};
const rdv = (id, jour, debut, fin) =>
  admin.collection('bookings').doc(id).set({
    providerId: PID, memberId: 'm1', locationId: 'lieu-1', status: 'confirmed',
    datetime: Timestamp.fromDate(a(jour, debut)), endDatetime: Timestamp.fromDate(a(jour, fin)),
    clientInfo: { name: `Cliente ${id}` }, serviceName: 'Séance',
  });

async function base({ variables = false } = {}) {
  await vider();
  await p.set({
    businessName: 'Studio test', isPublished: true,
    settings: { defaultBufferTime: 0, slotInterval: 30, minBookingNotice: 0, maxBookingAdvance: 90 },
  });
  await p.collection('locations').doc('lieu-1').set({ name: 'Studio', isActive: true, timezone: FUSEAU });
  await p.collection('members').doc('m1').set({
    name: 'Ingé', isActive: true, isDefault: true, locationId: 'lieu-1', variableHours: variables,
  });
  await semaineType();
}

describe('planning jour par jour', () => {
  before(() => base());

  it('semaine type, jour fermé par un réglage, samedi ouvert par un autre', async () => {
    const ferme = await dater({ from: jourN(2), to: jourN(2), mode: 'closed' });
    const samedi = await dater({ from: jourN(5), to: jourN(5), mode: 'slots', slots: [{ start: '10:00', end: '14:00' }] });
    const { jours, reglages, horairesVariables } = await schedulingService.getPlanningHoraires(PID, 'm1', jourN(0), jourN(6), FUSEAU);
    assert.equal(horairesVariables, false);
    assert.equal(jours.length, 7);
    assert.deepEqual(jours.map((j) => j.ouvert), [true, true, false, true, true, true, false]);
    assert.deepEqual(jours.map((j) => j.source), ['semaine', 'semaine', 'date', 'semaine', 'semaine', 'date', 'semaine']);
    assert.equal(jours[2].reglageId, ferme);
    assert.equal(jours[5].reglageId, samedi);
    assert.deepEqual(jours[5].plages, [{ start: '10:00', end: '14:00' }]);
    assert.equal(reglages.length, 2);
  });
});

describe('horaires variables', () => {
  before(() => base({ variables: true }));

  it('seuls les jours réglés sont ouverts', async () => {
    await dater({ from: jourN(1), to: jourN(1), mode: 'slots', slots: [{ start: '14:00', end: '22:00' }] });
    const { jours, horairesVariables } = await schedulingService.getPlanningHoraires(PID, 'm1', jourN(0), jourN(6), FUSEAU);
    assert.equal(horairesVariables, true);
    assert.deepEqual(jours.map((j) => j.ouvert), [false, true, false, false, false, false, false]);
    assert.deepEqual(jours.map((j) => j.source), ['variables', 'date', 'variables', 'variables', 'variables', 'variables', 'variables']);
  });
});

describe('rendez-vous touchés par un changement (aperçu, rien n’est écrit)', () => {
  before(async () => {
    await base();
    await rdv('mercredi-matin', jourN(2), '10:00', '11:00');
    await rdv('mercredi-soir', jourN(2), '16:00', '17:00');
    // Déjà hors horaires AVANT (dimanche fermé) : pas un effet du changement.
    await rdv('dimanche', jourN(6), '10:00', '11:00');
  });

  const reglage = (r) => ({ memberId: 'm1', locationId: 'lieu-1', weekdays: [], slots: [], ...r });

  it('fermer le mercredi : ses deux rendez-vous, « jour fermé »', async () => {
    const c = await schedulingService.conflitsHorairesDates(PID, reglage({ from: jourN(2), to: jourN(2), mode: 'closed' }), FUSEAU);
    assert.deepEqual(c.map((x) => [x.bookingId, x.conflictType]).sort(), [['mercredi-matin', 'day_closed'], ['mercredi-soir', 'day_closed']]);
  });

  it('réduire le mercredi à 9h–12h : seul celui de 16h sort', async () => {
    const c = await schedulingService.conflitsHorairesDates(
      PID, reglage({ from: jourN(2), to: jourN(2), mode: 'slots', slots: [{ start: '09:00', end: '12:00' }] }), FUSEAU,
    );
    assert.deepEqual(c.map((x) => [x.bookingId, x.conflictType]), [['mercredi-soir', 'reduced_hours']]);
  });

  it('fermer toute la semaine SAUF le mercredi (jours choisis) : aucun', async () => {
    const c = await schedulingService.conflitsHorairesDates(
      PID, reglage({ from: jourN(0), to: jourN(6), weekdays: [1, 2, 4, 5], mode: 'closed' }), FUSEAU,
    );
    assert.deepEqual(c, []);
  });

  it('passer en horaires variables sans rien régler : les deux du mercredi', async () => {
    const { conflicts } = await schedulingService.setHorairesVariables(PID, 'm1', true, { timeZone: FUSEAU, ecrire: false });
    assert.deepEqual(conflicts.map((x) => x.bookingId).sort(), ['mercredi-matin', 'mercredi-soir']);
    const membre = await p.collection('members').doc('m1').get();
    assert.equal(membre.data().variableHours, false, 'l’aperçu n’écrit rien');
  });

  it('copier une semaine au mercredi fermé sur la suivante : le rendez-vous de la semaine d’après', async () => {
    await rdv('mercredi-suivant', jourN(9), '10:00', '11:00');
    await dater({ from: jourN(2), to: jourN(2), mode: 'closed' });
    const r = await schedulingService.copierSemaineHoraires(
      PID, { memberId: 'm1', locationId: 'lieu-1', lundiSource: LUNDI, nombreDeSemaines: 1 }, { timeZone: FUSEAU, ecrire: false },
    );
    assert.equal(r.du, jourN(7));
    assert.equal(r.au, jourN(13));
    assert.deepEqual(r.conflicts.map((x) => x.bookingId), ['mercredi-suivant']);
    assert.deepEqual(r.ids, []);
  });

  it('supprimer le réglage « samedi ouvert » : le rendez-vous du samedi', async () => {
    const id = await dater({ from: jourN(5), to: jourN(5), mode: 'slots', slots: [{ start: '10:00', end: '14:00' }] });
    await rdv('samedi', jourN(5), '11:00', '12:00');
    const snap = await p.collection('datedAvailability').doc(id).get();
    const reglageLu = { id, ...snap.data(), createdAt: snap.data().createdAt.toDate() };
    const c = await schedulingService.conflitsSuppressionHorairesDates(PID, reglageLu, FUSEAU);
    assert.deepEqual(c.map((x) => [x.bookingId, x.conflictType]), [['samedi', 'day_closed']]);
  });

  it('refuse un réglage invalide, avec son code', async () => {
    await assert.rejects(
      schedulingService.conflitsHorairesDates(PID, reglage({ from: jourN(3), to: jourN(1), mode: 'closed' }), FUSEAU),
      (e) => e.code === 'ordre',
    );
  });
});

describe('le moteur de créneaux suit les horaires datés', () => {
  before(async () => {
    await base({ variables: true });
    await p.collection('services').doc('s1').set({
      name: 'Séance', duration: 60, bufferTime: 0, price: 5000, isActive: true, locationIds: ['lieu-1'], memberIds: ['m1'],
    });
    await dater({ from: jourN(1), to: jourN(1), mode: 'slots', slots: [{ start: '14:00', end: '17:00' }] });
  });

  it('horaires variables : seul le mardi réglé propose des créneaux, dans ses plages', async () => {
    const creneaux = await schedulingService.getAvailableSlots({
      providerId: PID, serviceId: 's1', memberId: 'm1',
      startDate: a(jourN(0), '00:00'), endDate: a(jourN(6), '23:59'),
      startDay: jourN(0), endDay: jourN(6), timeZone: FUSEAU,
    });
    assert.ok(creneaux.length > 0, 'le mardi réglé doit ouvrir des créneaux');
    assert.deepEqual([...new Set(creneaux.map((c) => jourLocal(c.datetime, FUSEAU)))], [jourN(1)]);
    assert.equal(creneaux[0].start, '14:00');
    assert.equal(creneaux.at(-1).end, '17:00');
  });

  it('la vérification finale suit la même règle', async () => {
    const dedans = await schedulingService.isSlotAvailable({ providerId: PID, memberId: 'm1', datetime: a(jourN(1), '15:00'), duration: 60, timeZone: FUSEAU });
    const lundi = await schedulingService.isSlotAvailable({ providerId: PID, memberId: 'm1', datetime: a(jourN(0), '10:00'), duration: 60, timeZone: FUSEAU });
    assert.equal(dedans, true);
    assert.equal(lundi, false, 'lundi : semaine type ouverte, mais horaires variables sans réglage → fermé');
  });
});

describe('semaine prochaine vide (badges)', () => {
  // Le lundi qui suit la semaine en cours, comme le service.
  const lundiProchain = ajouterJours(aujourdhui, ((8 - new Date(`${aujourdhui}T12:00:00Z`).getUTCDay()) % 7) || 7);

  before(async () => {
    await base({ variables: true });
    await p.collection('members').doc('m2').set({ name: 'Remplit', isActive: true, locationId: 'lieu-1', variableHours: true });
    await p.collection('members').doc('m3').set({ name: 'Semaine type', isActive: true, locationId: 'lieu-1', variableHours: false });
    await p.collection('members').doc('m4').set({ name: 'Inactif', isActive: false, locationId: 'lieu-1', variableHours: true });
    await p.collection('datedAvailability').add({
      memberId: 'm2', locationId: 'lieu-1', from: ajouterJours(lundiProchain, 2), to: ajouterJours(lundiProchain, 2),
      weekdays: [], mode: 'slots', slots: [{ start: '14:00', end: '18:00' }], createdAt: Timestamp.now(),
    });
  });

  it('seuls les membres actifs en horaires variables sans aucun jour ouvert', async () => {
    const r = await schedulingService.getSemaineProchaineVide(PID, FUSEAU);
    assert.equal(r.lundi, lundiProchain);
    assert.deepEqual(r.memberIds, ['m1']);
  });
});

// Le client Firestore garde le processus ouvert : on le relâche.
after(async () => {
  await vider();
  const { terminate, getFirestore: getClientDb } = await import('firebase/firestore');
  const { getFirebaseApp } = await import(pathToFileURL(resolve(racine, 'packages/firebase/src/lib/config.ts')).href);
  await terminate(getClientDb(getFirebaseApp()));
});
