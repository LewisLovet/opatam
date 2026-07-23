/**
 * Seed de démo « captures store » — Salon de Coiffure (67urFFyBFlUHd9Oa1QF8C2fcQha2).
 *
 * Crée des données réalistes et ENTIÈREMENT taggées pour les captures :
 *   - fidélité (settings.loyalty + clients à divers niveaux de jauge, 1 récompense prête)
 *   - promotion sur « Coupe transformation » (-20 %, compte à rebours)
 *   - variations + options sur « Coiffure classique »
 *   - agenda : jours pleins / moyens / creux sur 2 semaines, 3 membres
 *   - activités perso + créneaux bloqués (dont 1 « autres revenus »)
 *   - résas invités (sans compte), résas passées pour les stats, VIP, annulées, noshow
 *
 * Traçabilité / réversibilité :
 *   - chaque doc créé porte `demoSeed: TAG`
 *   - les modifs du provider/services sont sauvegardées dans demoSeedBackups/{PID}
 *   - purge complète : scripts/purge-demo-store-shots.mjs
 *   - provider marqué isTest:true → exclu de l'analytics admin
 *
 * PRÉREQUIS : le garde demoSeed doit être DÉPLOYÉ dans les functions
 * (bookingEmails/bookingNotifications/sendBookingReminders/sendReviewRequests),
 * sinon chaque résa créée enverrait des emails de confirmation.
 * Le script refuse de tourner sans SEED_GUARD_DEPLOYED=1.
 *
 * Usage :
 *   SEED_GUARD_DEPLOYED=1 SA_PATH="$PWD/service-account.json" node scripts/seed-demo-store-shots.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const TAG = 'demo-store-shots-2026-07';
const PID = '67urFFyBFlUHd9Oa1QF8C2fcQha2';
const LOCATION_ID = 'fPDZCX3tjnQKBHZSKPbD';
const NOW = new Date();

if (process.env.SEED_GUARD_DEPLOYED !== '1') {
  console.error(
    'REFUS : déploie d’abord le garde demoSeed (firebase deploy --only functions:onBookingWrite,functions:sendBookingReminders,functions:sendReviewRequests)\n' +
      'puis relance avec SEED_GUARD_DEPLOYED=1.'
  );
  process.exit(1);
}

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();

// ── Référentiel du salon (relevé le 2026-07-23) ─────────────────────
const MEMBERS = {
  francois: { id: 'HdFiMF0OePbBLbwvhUUM', name: 'Francois', color: '#3B82F6' },
  arthur: { id: 'AiKWW4dER0Aq7WhzWsFZ', name: 'Arthur', color: '#8B5CF6' },
  mike: { id: 'zQQqtTUPc6FILvhswSV4', name: 'Mike', color: '#EC4899' },
};
const SERVICES = {
  classique: { id: 'hN2g3pPFLTHqKah3rzPc', name: 'Coiffure classique', price: 2000, duration: 45 },
  transformation: { id: '07ehHTuYjxbx0d7kLsLO', name: 'Coupe transformation', price: 4000, duration: 60 },
  enfant: { id: '73nV5RchT33wFmypuV6s', name: 'Coupe enfant (-12 ans)', price: 1500, duration: 30 },
  barbeSoin: { id: 'aAASDyWs71w1GXZAmCDX', name: 'Taillage de barbe + soin', price: 1000, duration: 20 },
  barbe: { id: 'LcefkteXK82gqvLW3Pmo', name: 'Taillage de barbe', price: 500, duration: 10 },
};
const PROVIDER_NAME = 'Salon de Coiffure';
const LOCATION_NAME = 'Salon de coiffure';
const LOCATION_ADDRESS = '1 Rue de la République 69001 Lyon, 69001 Lyon';

// Promo : -20 % sur Coupe transformation → prix effectif 3200.
const PROMO = { percent: 20, excludedIds: [], startsAt: '2026-07-20', endsAt: '2026-08-02' };
const promoPrice = (cents) => Math.round(cents * (1 - PROMO.percent / 100));

// ── Petits utilitaires ──────────────────────────────────────────────
/** Date locale Europe/Paris (été = UTC+2) → Date UTC. */
const local = (ymd, hm) => new Date(`${ymd}T${hm}:00+02:00`);
const ts = (d) => Timestamp.fromDate(d);
const addMin = (d, m) => new Date(d.getTime() + m * 60000);
const randToken = () =>
  Array.from({ length: 32 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');

// PRNG déterministe (reproductible)
let seed = 42;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

let providerPhoto = null; // relu depuis le doc provider au démarrage

function bookingDoc({
  member, service, datetime, status = 'confirmed', client = null, clientInfo,
  createdAt, price, duration, items = null, selectedVariations = null, selectedOptions = null,
  serviceName = null, originalPrice = null, loyalty = null, cancelledBy = null,
  stampReviewSent = true,
}) {
  const dur = duration ?? service.duration;
  const past = datetime.getTime() < NOW.getTime();
  return {
    providerId: PID,
    clientId: client ?? null,
    memberId: member.id,
    providerName: PROVIDER_NAME,
    providerPhoto,
    memberName: member.name,
    memberPhoto: null,
    memberColor: member.color,
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
    locationProtected: false,
    locationApproxArea: null,
    locationAddress: LOCATION_ADDRESS,
    serviceId: service.id,
    serviceName: serviceName ?? service.name,
    serviceColor: null,
    duration: dur,
    price: price ?? service.price,
    priceMax: null,
    ...(originalPrice != null ? { originalPrice } : {}),
    ...(loyalty ? { loyalty } : {}),
    ...(items ? { items } : {}),
    ...(selectedVariations?.length ? { selectedVariations } : {}),
    ...(selectedOptions?.length ? { selectedOptions } : {}),
    clientInfo,
    clientLocale: 'fr',
    datetime: ts(datetime),
    endDatetime: ts(addMin(datetime, dur)),
    status,
    cancelledAt: status === 'cancelled' ? ts(addMin(datetime, -60 * 24)) : null,
    cancelledBy: status === 'cancelled' ? (cancelledBy ?? 'client') : null,
    cancelReason: status === 'cancelled' ? 'Empêchement de dernière minute' : null,
    cancelToken: randToken(),
    remindersSent: [],
    // Anti-« demande d'avis » même si le garde n'était pas déployé.
    reviewRequestSentAt: past && stampReviewSent ? ts(addMin(datetime, 26 * 60)) : null,
    deposit: null,
    createdAt: ts(createdAt),
    updatedAt: ts(createdAt),
    demoSeed: TAG,
  };
}

// ── 0. Lecture provider + backup ────────────────────────────────────
const providerRef = db.collection('providers').doc(PID);
const provSnap = await providerRef.get();
if (!provSnap.exists) throw new Error('Provider démo introuvable');
const prov = provSnap.data();
providerPhoto = prov.photoURL ?? prov.profilePhoto ?? null;
if (!providerPhoto) {
  const anyBooking = await db.collection('bookings').where('providerId', '==', PID).limit(1).get();
  providerPhoto = anyBooking.docs[0]?.data()?.providerPhoto ?? null;
}

const svcCol = providerRef.collection('services');
const svcBackup = {};
for (const key of ['classique', 'transformation']) {
  const s = await svcCol.doc(SERVICES[key].id).get();
  const d = s.data();
  svcBackup[SERVICES[key].id] = {
    variations: d.variations ?? null,
    options: d.options ?? null,
    discount: d.discount ?? null,
  };
}
await db.collection('demoSeedBackups').doc(PID).set({
  tag: TAG,
  createdAt: ts(NOW),
  settingsLoyalty: prov.settings?.loyalty ?? null,
  isTest: prov.isTest ?? null,
  services: svcBackup,
});
console.log('backup écrit → demoSeedBackups/' + PID);

// ── 1. Provider : fidélité + isTest ─────────────────────────────────
await providerRef.update({
  'settings.loyalty': {
    enabled: true,
    threshold: 6,
    rewardType: 'percent',
    rewardValue: 20,
    excludedServiceIds: [SERVICES.enfant.id], // → « toutes sauf Coupe enfant »
  },
  isTest: true,
});
console.log('provider : loyalty (6 RDV → -20 %) + isTest:true');

// ── 2. Services : variations/options + promo ────────────────────────
await svcCol.doc(SERVICES.classique.id).update({
  variations: [
    {
      id: 'demo-var-longueur',
      name: 'Longueur des cheveux',
      description: null,
      options: [
        { id: 'demo-lg-courts', name: 'Cheveux courts', description: null, price: 0, duration: 0 },
        { id: 'demo-lg-milongs', name: 'Cheveux mi-longs', description: null, price: 500, duration: 15 },
        { id: 'demo-lg-longs', name: 'Cheveux longs', description: null, price: 1000, duration: 30 },
      ],
    },
  ],
  options: [
    { id: 'demo-opt-soin', name: 'Shampoing + soin profond', description: 'Soin nourrissant appliqué après la coupe.', price: 800, duration: 10, nestedVariations: [], nestedInfoFields: [] },
    { id: 'demo-opt-colo', name: 'Coloration express', description: null, price: 1500, duration: 20, nestedVariations: [], nestedInfoFields: [] },
  ],
  updatedAt: ts(NOW),
});
await svcCol.doc(SERVICES.transformation.id).update({ discount: PROMO, updatedAt: ts(NOW) });
console.log('services : variations/options (Coiffure classique) + promo -20 % (Coupe transformation)');

// ── 3. Clients fidélité + VIP ───────────────────────────────────────
// Emails en plus-addressing vers le propriétaire : aucun tiers ne peut recevoir
// un mail, même si un chemin d'envoi nous échappe.
const mail = (slug) => `bwemba13+${slug}@gmail.com`;
const LOYALTY_CLIENTS = [
  { uid: 'demoseed-lea', name: 'Léa Martin', email: mail('lea.martin'), phone: '0612845733', count: 6 },
  { uid: 'demoseed-hugo', name: 'Hugo Bernard', email: mail('hugo.bernard'), phone: '0698215467', count: 5 },
  { uid: 'demoseed-chloe', name: 'Chloé Dubois', email: mail('chloe.dubois'), phone: '0645129873', count: 4 },
  { uid: 'demoseed-nathan', name: 'Nathan Petit', email: mail('nathan.petit'), phone: '0756841239', count: 3 },
  { uid: 'demoseed-emma', name: 'Emma Roux', email: mail('emma.roux'), phone: '0687453621', count: 2 },
  { uid: 'demoseed-lucas', name: 'Lucas Moreau', email: mail('lucas.moreau'), phone: '0723568941', count: 1 },
];
const SOFIA = { uid: 'demoseed-sofia', name: 'Sofia Garcia', email: mail('sofia.garcia'), phone: '0634871256' };

const docs = [];

// Résas comptant pour la fidélité : confirmées + clientId + createdAt ≥ 2026-07-20 + datetime passée.
// Les datetimes s'étalent sur juin/juillet (réalisme agenda/stats).
const loyaltySvcPool = [SERVICES.classique, SERVICES.transformation, SERVICES.barbeSoin];
const loyaltyDays = ['2026-06-05', '2026-06-12', '2026-06-19', '2026-06-26', '2026-07-03', '2026-07-10', '2026-07-17', '2026-07-21', '2026-07-22'];
let creations = [local('2026-07-20', '08:05'), local('2026-07-20', '11:40'), local('2026-07-20', '17:20'), local('2026-07-21', '09:10'), local('2026-07-21', '14:55'), local('2026-07-22', '10:25'), local('2026-07-22', '18:45'), local('2026-07-23', '08:15')];
let ci = 0;
for (const c of LOYALTY_CLIENTS) {
  for (let i = 0; i < c.count; i++) {
    const svc = loyaltySvcPool[(i + ci) % loyaltySvcPool.length];
    const day = loyaltyDays[(i * 2 + ci) % loyaltyDays.length];
    const hour = ['09:30', '11:00', '14:30', '16:00', '17:15'][(i + ci) % 5];
    docs.push(
      bookingDoc({
        member: i % 2 === 0 ? MEMBERS.francois : MEMBERS.arthur,
        service: svc,
        datetime: local(day, hour),
        client: c.uid,
        clientInfo: { name: c.name, email: c.email, phone: c.phone },
        createdAt: creations[(ci + i) % creations.length],
      })
    );
  }
  ci++;
}

// Sofia — VIP historique : 10 RDV confirmés (avant le lancement fidélité).
const sofiaDays = ['2026-03-06', '2026-03-20', '2026-04-03', '2026-04-17', '2026-05-01', '2026-05-15', '2026-05-29', '2026-06-12', '2026-06-26', '2026-07-10'];
for (const [i, day] of sofiaDays.entries()) {
  const svc = i % 3 === 0 ? SERVICES.transformation : SERVICES.classique;
  docs.push(
    bookingDoc({
      member: MEMBERS.francois,
      service: svc,
      datetime: local(day, i % 2 ? '10:00' : '15:30'),
      client: SOFIA.uid,
      clientInfo: { name: SOFIA.name, email: SOFIA.email, phone: SOFIA.phone },
      createdAt: addMin(local(day, '09:00'), -3 * 24 * 60),
    })
  );
}

// ── 4. Historique juin/juillet pour les stats (invités variés) ──────
const GUESTS = [
  ['Camille Rousseau', 'camille.rousseau@example.com', '0611224578'],
  ['Théo Lambert', 'theo.lambert@example.com', '0622337845'],
  ['Inès Bonnet', 'ines.bonnet@example.com', '0633448596'],
  ['Maxime Girard', 'maxime.girard@example.com', '0644559687'],
  ['Julie Fontaine', 'julie.fontaine@example.com', '0655668741'],
  ['Antoine Chevalier', 'antoine.chevalier@example.com', '0666779852'],
  ['Manon Da Silva', 'manon.dasilva@example.com', '0677881963'],
  ['Romain Lefevre', 'romain.lefevre@example.com', '0688992074'],
  ['Sarah Mercier', 'sarah.mercier@example.com', '0699003185'],
  ['Karim Benali', 'karim.benali@example.com', '0610114296'],
  ['Lucie Fabre', 'lucie.fabre@example.com', '0621225307'],
  ['Paul Renard', 'paul.renard@example.com', '0632336418'],
];
const guestInfo = (i) => {
  const [name, email, phone] = GUESTS[i % GUESTS.length];
  return { name, email, phone };
};

const pastDays = [
  '2026-06-02', '2026-06-04', '2026-06-06', '2026-06-09', '2026-06-11', '2026-06-13',
  '2026-06-16', '2026-06-18', '2026-06-20', '2026-06-23', '2026-06-25', '2026-06-30',
  '2026-07-02', '2026-07-04', '2026-07-07', '2026-07-09', '2026-07-11', '2026-07-15',
  '2026-07-16', '2026-07-18', '2026-07-21', '2026-07-22',
];
const svcAll = Object.values(SERVICES);
pastDays.forEach((day, i) => {
  docs.push(
    bookingDoc({
      member: pick([MEMBERS.francois, MEMBERS.arthur, MEMBERS.mike]),
      service: pick(svcAll),
      datetime: local(day, pick(['09:15', '10:30', '11:15', '14:15', '15:45', '16:30', '17:00'])),
      clientInfo: guestInfo(i),
      createdAt: addMin(local(day, '08:00'), -2 * 24 * 60),
    })
  );
});
// Quelques annulées + noshow (réalisme des stats et de la page Clients)
for (const [day, status, i] of [
  ['2026-07-08', 'cancelled', 3], ['2026-07-12', 'cancelled', 6], ['2026-06-27', 'cancelled', 9],
  ['2026-07-05', 'noshow', 4], ['2026-06-21', 'noshow', 7],
]) {
  docs.push(
    bookingDoc({
      member: pick([MEMBERS.francois, MEMBERS.arthur]),
      service: pick(svcAll),
      datetime: local(day, '15:00'),
      status,
      clientInfo: guestInfo(i),
      createdAt: addMin(local(day, '08:00'), -4 * 24 * 60),
    })
  );
}

// ── 5. Agenda à venir : jours pleins / moyens / creux ───────────────
// Fenêtres d'ouverture par membre (relevé availability ; 0=Dim … 6=Sam).
const HOURS = {
  [MEMBERS.arthur.id]: { 0: [['09:00', '18:00']], 1: [['09:00', '18:00']], 2: [['09:00', '18:00']], 4: [['09:00', '18:00']], 5: [['09:00', '18:00']] },
  [MEMBERS.francois.id]: {
    0: [['09:00', '12:00']],
    1: [['09:00', '12:00'], ['14:00', '18:00']],
    2: [['10:00', '12:00'], ['14:00', '18:00']],
    3: [['09:00', '12:00'], ['14:00', '18:00']],
    4: [['08:30', '12:00'], ['14:00', '18:00']],
    5: [['09:00', '12:00'], ['14:00', '18:00']],
  },
  [MEMBERS.mike.id]: { 1: [['09:00', '18:00']], 2: [['09:00', '18:00']], 3: [['09:00', '18:00']], 4: [['09:00', '18:00']], 5: [['09:00', '18:00']] },
};
// Taux de remplissage cible par jour (1 = complet, 0 = libre).
const FILL = {
  '2026-07-24': 1.0, '2026-07-25': 0.7, '2026-07-26': 0.15, '2026-07-27': 0.85,
  '2026-07-28': 0.35, '2026-07-29': 0, '2026-07-30': 0.6, '2026-07-31': 0.3,
  '2026-08-01': 0.5, '2026-08-02': 0.15, '2026-08-03': 0.4, '2026-08-04': 0.6,
};
// Clients connus qui reviennent + invités : mélange réaliste.
const futureClients = [
  ...LOYALTY_CLIENTS.map((c) => ({ client: c.uid, clientInfo: { name: c.name, email: c.email, phone: c.phone } })),
  { client: SOFIA.uid, clientInfo: { name: SOFIA.name, email: SOFIA.email, phone: SOFIA.phone } },
  ...GUESTS.map(([name, email, phone]) => ({ client: null, clientInfo: { name, email, phone } })),
];
const toMin = (hm) => +hm.slice(0, 2) * 60 + +hm.slice(3);
const toHm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

let leaFutureDone = false;
for (const [day, fill] of Object.entries(FILL)) {
  if (fill === 0) continue;
  const dow = local(day, '12:00').getDay();
  for (const m of Object.values(MEMBERS)) {
    // Mike en congés (créneau bloqué) du 31/07 au 02/08 — pas de résa.
    if (m.id === MEMBERS.mike.id && ['2026-07-31', '2026-08-01', '2026-08-02'].includes(day)) continue;
    const windows = HOURS[m.id]?.[dow];
    if (!windows) continue;
    for (const [start, end] of windows) {
      let cur = toMin(start);
      const endM = toMin(end);
      while (cur + 20 <= endM) {
        if (rand() > fill) {
          cur += pick([30, 45, 60]); // trou
          continue;
        }
        const who = pick(futureClients);
        const svc = pick(svcAll);
        let extra = {};
        let dur = svc.duration;
        let price = svc.price;
        // Promo visible sur les Coupe transformation à venir
        if (svc.id === SERVICES.transformation.id) {
          extra = { originalPrice: svc.price };
          price = promoPrice(svc.price);
        }
        // Variations/options visibles sur quelques Coiffure classique
        if (svc.id === SERVICES.classique.id && rand() < 0.45) {
          const lg = pick([
            { id: 'demo-lg-milongs', name: 'Cheveux mi-longs', price: 500, duration: 15 },
            { id: 'demo-lg-longs', name: 'Cheveux longs', price: 1000, duration: 30 },
          ]);
          const withSoin = rand() < 0.5;
          dur = svc.duration + lg.duration + (withSoin ? 10 : 0);
          price = svc.price + lg.price + (withSoin ? 800 : 0);
          extra = {
            selectedVariations: [{ variationId: 'demo-var-longueur', variationName: 'Longueur des cheveux', optionId: lg.id, optionName: lg.name, price: lg.price, duration: lg.duration }],
            selectedOptions: withSoin
              ? [{ optionId: 'demo-opt-soin', optionName: 'Shampoing + soin profond', price: 800, duration: 10, nestedVariations: [], infoValues: {} }]
              : [],
          };
        }
        // La prochaine résa de Léa (récompense prête) : -20 % fidélité appliquée
        if (!leaFutureDone && who.client === 'demoseed-lea' && svc.id === SERVICES.classique.id && !extra.selectedVariations) {
          extra = { originalPrice: price, loyalty: { rewardType: 'percent', rewardValue: 20, amountOff: Math.round(price * 0.2), threshold: 6 } };
          price = price - Math.round(price * 0.2);
          leaFutureDone = true;
        }
        docs.push(
          bookingDoc({
            member: m,
            service: svc,
            datetime: local(day, toHm(cur)),
            client: who.client,
            clientInfo: who.clientInfo,
            createdAt: addMin(NOW, -Math.floor(rand() * 5 * 24 * 60)),
            price,
            duration: dur,
            stampReviewSent: false,
            ...extra,
          })
        );
        cur += dur + pick([0, 15, 15, 30]);
      }
    }
  }
}

// Une résa multi-prestations à venir (récap « + » dans l'agenda)
{
  const items = [SERVICES.classique, SERVICES.barbeSoin].map((s) => ({
    serviceId: s.id, serviceName: s.name, serviceColor: null, duration: s.duration, price: s.price,
    selectedVariations: [], selectedOptions: [], selectedInfoValues: {}, selectedInfo: [],
  }));
  docs.push(
    bookingDoc({
      member: MEMBERS.arthur,
      service: SERVICES.classique,
      serviceName: `${SERVICES.classique.name} + ${SERVICES.barbeSoin.name}`,
      datetime: local('2026-07-27', '10:00'),
      client: null,
      clientInfo: guestInfo(2),
      createdAt: addMin(NOW, -36 * 60),
      price: SERVICES.classique.price + SERVICES.barbeSoin.price,
      duration: SERVICES.classique.duration + SERVICES.barbeSoin.duration,
      items,
      stampReviewSent: false,
    })
  );
}

// ── 6. Écriture des bookings (par lots, triggers prod actifs) ───────
console.log(`écriture de ${docs.length} bookings…`);
const bookingIds = [];
for (let i = 0; i < docs.length; i += 10) {
  const batch = db.batch();
  for (const d of docs.slice(i, i + 10)) {
    const ref = db.collection('bookings').doc();
    bookingIds.push(ref.id);
    batch.set(ref, d);
  }
  await batch.commit();
  process.stdout.write(`  ${Math.min(i + 10, docs.length)}/${docs.length}\r`);
  await new Promise((r) => setTimeout(r, 800)); // laisse respirer les triggers
}
console.log(`\nbookings écrits : ${bookingIds.length}`);

// ── 7. Activités perso + créneaux bloqués ───────────────────────────
const blocked = [
  { memberId: MEMBERS.francois.id, startDate: local('2026-07-28', '12:00'), endDate: local('2026-07-28', '12:00'), allDay: false, startTime: '12:00', endTime: '13:30', reason: null, category: 'sport', title: 'Salle de sport', address: null, amount: null },
  { memberId: MEMBERS.arthur.id, startDate: local('2026-07-30', '14:00'), endDate: local('2026-07-30', '14:00'), allDay: false, startTime: '14:00', endTime: '15:00', reason: null, category: 'meeting', title: 'Rendez-vous comptable', address: null, amount: null },
  { memberId: MEMBERS.arthur.id, startDate: local('2026-07-24', '17:00'), endDate: local('2026-07-24', '17:00'), allDay: false, startTime: '17:00', endTime: '18:00', reason: null, category: 'personal', title: 'Sortie école des enfants', address: null, amount: null },
  { memberId: MEMBERS.mike.id, startDate: local('2026-07-31', '00:00'), endDate: local('2026-08-02', '23:59'), allDay: true, startTime: null, endTime: null, reason: 'Congés', category: null, title: null, address: null, amount: null },
  { memberId: MEMBERS.francois.id, startDate: local('2026-07-18', '14:00'), endDate: local('2026-07-18', '14:00'), allDay: false, startTime: '14:00', endTime: '17:00', reason: null, category: 'prestation', title: 'Shooting photo mariage', address: 'Parc de la Tête d’Or, Lyon', amount: 15000 },
];
for (const b of blocked) {
  await providerRef.collection('blockedSlots').add({
    ...b,
    locationId: LOCATION_ID,
    startDate: ts(b.startDate),
    endDate: ts(b.endDate),
    createdAt: ts(NOW),
    demoSeed: TAG,
  });
}
console.log(`blockedSlots écrits : ${blocked.length}`);

// ── 8. Stats rolling (top prestations / clients / heatmap) ──────────
// Le trigger ne maintient pas providerStatsRolling (cron nocturne) — on le
// recalcule tout de suite avec le même code compilé que le cron.
await new Promise((r) => setTimeout(r, 15000)); // laisse les triggers daily finir
const agg = require('../functions/dist/lib/providerStatsAgg.js');
const cutoff90 = new Date(NOW.getTime() - 90 * 24 * 3600 * 1000);
const [dailiesSnap, bookingsSnap] = await Promise.all([
  db.collection('providerStatsDaily').where('providerId', '==', PID).get(),
  db.collection('bookings').where('providerId', '==', PID).where('datetime', '>=', ts(cutoff90)).get(),
]);
const rolling = agg.aggregateRolling(
  dailiesSnap.docs.map((d) => d.data()),
  bookingsSnap.docs.map((d) => agg.bookingFromFirestore(d.data())),
  PID,
  NOW
);
await db.collection('providerStatsRolling').doc(PID).set(rolling, { merge: false });
console.log('providerStatsRolling recalculé');

console.log(`\nSEED TERMINÉ — tag: ${TAG}`);
console.log('Purge : SA_PATH=… node scripts/purge-demo-store-shots.mjs');
