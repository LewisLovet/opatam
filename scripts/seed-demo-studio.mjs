/**
 * Studio Harmonie — le studio d'enregistrement de démonstration derrière
 * la page verticale /studio-enregistrement.
 *
 * POURQUOI CE COMPTE EXISTE : la page promet « essayez-le comme un artiste »
 * et ouvre le vrai tunnel de réservation. Sans prestataire publié derrière le
 * slug, `/p/studio-harmonie/embed` répond 404 et la fenêtre reste blanche.
 *
 * CE QU'IL MODÉLISE : l'ÉQUIPE. Les membres sont les trois ingénieurs du
 * son, chacun avec son agenda, et chaque prestation est rattachée à ceux qui
 * savent la faire. L'artiste choisit donc la session PUIS la personne — ce
 * qui montre au gérant de studio qu'il peut mettre son équipe sur Opatam.
 *
 * LA SALLE VIT DANS LE NOM DE LA PRESTATION (« Studio A — session 4 h ») et
 * non dans un agenda séparé. Opatam n'a qu'un axe de réservation : on
 * modélise soit les personnes, soit les espaces, pas les deux à la fois.
 * Conséquence assumée et documentée sur la page : deux ingénieurs libres au
 * même créneau peuvent être réservés sur la même salle. Un vrai studio
 * arbitre ça en n'affectant pas deux personnes au même espace — c'est une
 * règle d'organisation, pas une garantie du logiciel.
 *
 * PAS D'ACOMPTE, VOLONTAIREMENT : l'encaissement exige
 * `provider.stripeConnectAccountId` (apps/web/app/api/bookings/route.ts).
 * Un compte de démonstration n'en a pas ; y activer un acompte laisserait
 * les réservations en `pending_payment` sans PaymentIntent — un tunnel cassé
 * est pire qu'un tunnel sans acompte.
 *
 * Traçabilité / réversibilité :
 *   - tous les documents portent `demoSeed: TAG`
 *   - `isTest: true` → exclu de l'analytique admin ET du sitemap
 *   - purge complète : `node scripts/seed-demo-studio.mjs --purge`
 *
 * PRÉREQUIS : le garde `demoSeed` doit être déployé dans les functions,
 * sinon la moindre réservation de démonstration déclencherait de vrais
 * e-mails. Le script refuse de tourner sans SEED_GUARD_DEPLOYED=1.
 *
 * Usage :
 *   SEED_GUARD_DEPLOYED=1 SA_PATH="$PWD/service-account.json" node scripts/seed-demo-studio.mjs
 *   SA_PATH="$PWD/service-account.json" node scripts/seed-demo-studio.mjs --purge
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

const TAG = 'demo-studio-enregistrement';
const SLUG = 'studio-harmonie';
// Plus-addressing vers le propriétaire : même si un chemin d'envoi nous
// échappait, aucun tiers ne peut recevoir un e-mail de ce compte.
const EMAIL = 'bwemba13+studio-harmonie@gmail.com';
const PURGE = process.argv.includes('--purge');

if (!PURGE && process.env.SEED_GUARD_DEPLOYED !== '1') {
  console.error(
    'REFUS : le garde demoSeed doit être déployé dans les functions avant de créer\n' +
      'des données de démonstration, sinon les réservations déclenchent de vrais e-mails.\n' +
      'Relance avec SEED_GUARD_DEPLOYED=1 une fois le déploiement fait.',
  );
  process.exit(1);
}

const saPath = process.env.SA_PATH ?? 'service-account.json';
initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf-8'))), projectId: 'opatam-da04b' });
const db = getFirestore();
const auth = getAuth();
const ts = (d) => Timestamp.fromDate(d);
const NOW = new Date();

// ── Le studio ────────────────────────────────────────────────────────
const LOCATION_ID = 'demo-studio-lieu';

/** L'équipe. Ce sont eux, les agendas — c'est ce qui permet à l'artiste de
 *  choisir avec qui il enregistre. */
const ENGINEERS = [
  {
    id: 'demo-ing-naim',
    name: 'Naïm Berkaoui',
    role: 'Prise de son & mixage',
    color: '#2563EB',
    sortOrder: 0,
    isDefault: true,
  },
  {
    id: 'demo-ing-clara',
    name: 'Clara Vasseur',
    role: 'Prise de son & voix',
    color: '#7C3AED',
    sortOrder: 1,
  },
  {
    id: 'demo-ing-yanis',
    name: 'Yanis Delorme',
    role: 'Beatmaking & production',
    color: '#0EA5E9',
    sortOrder: 2,
  },
];

const CATEGORY_ID = 'demo-studio-categorie';

/** Les prestations. `memberIds` liste qui sait faire quoi : c'est ce
 *  rattachement qui produit l'écran « choisissez un professionnel », et qui
 *  fait que la cabine voix ne propose que Clara. Certaines sessions laissent
 *  le choix entre deux personnes, d'autres non — c'est la réalité d'un
 *  studio, et c'est plus parlant qu'une liste où tout le monde fait tout. */
const SERVICES = [
  {
    id: 'demo-svc-a-4h',
    name: 'Studio A — session 4 h',
    description:
      'Grande salle, régie séparée et console analogique. Au choix avec Naïm ou Clara.',
    duration: 240,
    price: 18000,
    memberIds: ['demo-ing-naim', 'demo-ing-clara'],
    sortOrder: 0,
  },
  {
    id: 'demo-svc-a-journee',
    name: 'Studio A — journée complète',
    description: 'Huit heures dans la grande salle, pauses comprises. Le format des sessions de groupe.',
    duration: 480,
    price: 32000,
    memberIds: ['demo-ing-naim'],
    sortOrder: 1,
  },
  {
    id: 'demo-svc-b-4h',
    name: 'Studio B — session 4 h',
    description: 'Salle de prise pour les formats légers : voix, guitare, podcast à deux micros.',
    duration: 240,
    price: 14000,
    memberIds: ['demo-ing-clara', 'demo-ing-yanis'],
    sortOrder: 2,
  },
  {
    id: 'demo-svc-voix-2h',
    name: 'Cabine voix — session 2 h',
    description: 'Cabine traitée, micro à condensateur, retour casque. Clara vous dirige.',
    duration: 120,
    price: 7000,
    memberIds: ['demo-ing-clara'],
    sortOrder: 3,
  },
  {
    id: 'demo-svc-mix',
    name: 'Mixage — par titre',
    description: 'Mixage d’un titre en régie, avec vous ou sans vous. Deux retours inclus.',
    duration: 180,
    price: 15000,
    memberIds: ['demo-ing-naim'],
    sortOrder: 4,
  },
  {
    id: 'demo-svc-beat',
    name: 'Beatmaking — session 3 h',
    description: 'Composition et production d’une instru avec Yanis, du sketch à la maquette.',
    duration: 180,
    price: 12000,
    memberIds: ['demo-ing-yanis'],
    sortOrder: 5,
  },
];

/** Horaires : ouvert du lundi au samedi, 10 h → 23 h. Un studio vit le soir,
 *  et c'est précisément ce que la page raconte. Dimanche fermé.
 *  `dayOfWeek` suit la convention JavaScript — 0 = dimanche. */
const OPENING = { start: '10:00', end: '23:00' };

async function purge() {
  const snap = await db.collection('providers').where('slug', '==', SLUG).limit(1).get();
  if (snap.empty) {
    console.log('rien à purger : aucun prestataire', SLUG);
    return;
  }
  const ref = snap.docs[0].ref;
  for (const col of await ref.listCollections()) {
    const docs = await col.get();
    await Promise.all(docs.docs.map((d) => d.ref.delete()));
    console.log(`  supprimé ${docs.size} docs dans ${col.id}`);
  }
  await ref.delete();
  console.log('provider supprimé');
  try {
    const user = await auth.getUserByEmail(EMAIL);
    await auth.deleteUser(user.uid);
    console.log('compte Auth supprimé');
  } catch {
    console.log('aucun compte Auth à supprimer');
  }
}

async function seed() {
  // ── Compte Auth ────────────────────────────────────────────────────
  // Le doc provider est indexé par l'uid : il faut donc l'utilisateur
  // d'abord. Idempotent — relancer le script ne crée pas de doublon.
  let uid;
  try {
    uid = (await auth.getUserByEmail(EMAIL)).uid;
    console.log('compte Auth existant :', uid);
  } catch {
    uid = (
      await auth.createUser({
        email: EMAIL,
        emailVerified: true,
        displayName: 'Studio Harmonie',
        password: `demo-${Math.random().toString(36).slice(2)}-${Date.now()}`,
      })
    ).uid;
    console.log('compte Auth créé :', uid);
  }

  const ref = db.collection('providers').doc(uid);

  // ── Le prestataire ─────────────────────────────────────────────────
  await ref.set(
    {
      userId: uid,
      businessName: 'Studio Harmonie',
      slug: SLUG,
      category: 'audiovisual',
      description:
        "Studio d'enregistrement à Lyon 7ᵉ, ouvert du lundi au samedi jusqu'à 23 h. " +
        'Trois espaces réservables séparément — Studio A avec sa régie et sa console analogique, ' +
        'Studio B pour les formats légers, et une cabine voix. ' +
        'Trois ingénieurs du son — Naïm, Clara et Yanis — chacun avec ses spécialités : ' +
        'vous choisissez la session puis la personne avec qui vous travaillez. ' +
        'Ce studio est une démonstration du produit Opatam.',
      // Une adresse de démonstration doit rester manifestement fictive : pas
      // de numéro de rue réel, pour ne pas envoyer quelqu'un sonner chez un
      // tiers.
      city: 'Lyon',
      cities: ['lyon'],
      region: 'Auvergne-Rhône-Alpes',
      countryCode: 'FR',
      searchTokens: [
        'stu', 'stud', 'studi', 'studio', 'har', 'harm', 'harmo', 'harmon', 'harmoni', 'harmonie',
      ],
      geopoint: null,
      photoURL: null,
      coverPhotoURL: null,
      portfolioPhotos: [],
      socialLinks: {},
      isPublished: true,
      isVerified: false,
      // Exclut ce compte de l'analytique admin ET du sitemap : un studio
      // fictif ne doit jamais être proposé à l'indexation comme un vrai
      // commerce.
      isTest: true,
      demoSeed: TAG,
      plan: 'team',
      subscription: {
        plan: 'team',
        status: 'active',
        tier: 'standard',
        memberCount: ENGINEERS.length,
        paymentSource: 'comp',
        cancelAtPeriodEnd: false,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: ts(new Date(NOW.getTime() + 365 * 864e5)),
        validUntil: ts(new Date(NOW.getTime() + 365 * 864e5)),
      },
      rating: { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } },
      settings: {
        timezone: 'Europe/Paris',
        // Une session se cale en pas de 30 minutes : personne ne réserve un
        // studio à 14 h 07.
        slotInterval: 30,
        defaultBufferTime: 30, // remise en place entre deux sessions
        requiresConfirmation: false,
        // Deux heures de préavis : le temps de patcher et de préparer.
        minBookingNotice: 120,
        maxBookingAdvance: 60,
        allowClientCancellation: true,
        cancellationDeadline: 48,
        reminderTimes: [24, 2],
        autoReviewReminder: false,
        globalDiscount: null,
        bookingNotice:
          "Studio de démonstration Opatam : aucune session n'est réellement réservée et aucun acompte n'est encaissé.",
      },
      minPrice: Math.min(...SERVICES.map((s) => s.price)),
      createdAt: ts(NOW),
      updatedAt: ts(NOW),
    },
    { merge: true },
  );
  console.log('provider écrit :', SLUG);

  // ── Le lieu ────────────────────────────────────────────────────────
  await ref.collection('locations').doc(LOCATION_ID).set({
    name: 'Studio Harmonie',
    address: 'Quartier Jean Macé, 69007 Lyon',
    postalCode: '69007',
    city: 'Lyon',
    country: 'France',
    description: null,
    type: 'fixed',
    travelRadius: null,
    isDefault: true,
    isActive: true,
    demoSeed: TAG,
    createdAt: ts(NOW),
    updatedAt: ts(NOW),
  });

  // ── L'équipe, en tant qu'agendas ───────────────────────────────────
  for (const room of ENGINEERS) {
    await ref.collection('members').doc(room.id).set({
      name: room.name,
      role: room.role,
      email: null,
      phone: null,
      photoURL: null,
      accessCode: null,
      locationId: LOCATION_ID,
      isDefault: room.isDefault ?? false,
      sortOrder: room.sortOrder,
      color: room.color,
      isActive: true,
      demoSeed: TAG,
      createdAt: ts(NOW),
      updatedAt: ts(NOW),
    });

    // Horaires : lundi (1) à samedi (6) ouverts, dimanche (0) fermé.
    for (let day = 0; day < 7; day++) {
      await ref.collection('availability').doc(`${room.id}_${day}`).set({
        memberId: room.id,
        locationId: LOCATION_ID,
        dayOfWeek: day,
        isOpen: day !== 0,
        slots: day === 0 ? [] : [OPENING],
        effectiveFrom: null,
        demoSeed: TAG,
        updatedAt: ts(NOW),
      });
    }
  }
  console.log(`${ENGINEERS.length} membres + horaires écrits`);

  // ── Prestations ────────────────────────────────────────────────────
  await ref.collection('serviceCategories').doc(CATEGORY_ID).set({
    name: 'Sessions studio',
    sortOrder: 0,
    isActive: true,
    demoSeed: TAG,
    createdAt: ts(NOW),
    updatedAt: ts(NOW),
  });

  for (const svc of SERVICES) {
    await ref.collection('services').doc(svc.id).set({
      name: svc.name,
      description: svc.description,
      duration: svc.duration,
      price: svc.price,
      priceMax: null,
      bufferTime: 0,
      categoryId: CATEGORY_ID,
      locationIds: [LOCATION_ID],
      memberIds: svc.memberIds,
      isActive: true,
      isAvailable: true,
      sortOrder: svc.sortOrder,
      photoURL: null,
      color: null,
      variations: [],
      options: [],
      infoFields: [],
      discount: null,
      // Voir l'en-tête : pas d'acompte sans compte Stripe connecté.
      deposit: null,
      demoSeed: TAG,
      createdAt: ts(NOW),
      updatedAt: ts(NOW),
    });
  }
  console.log(`${SERVICES.length} prestations écrites`);

  console.log('\nStudio prêt :');
  console.log('  page publique  https://opatam.com/p/' + SLUG);
  console.log('  tunnel embed   https://opatam.com/p/' + SLUG + '/embed');
}

await (PURGE ? purge() : seed());
process.exit(0);
