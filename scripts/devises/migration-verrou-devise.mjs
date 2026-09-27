/**
 * Migration — verrou de devise des prestataires ayant DÉJÀ encaissé.
 *
 * Le verrou (`Provider.currencyLockedAt`) est posé par le webhook au premier
 * acompte payé APRÈS le déploiement. Les prestataires qui ont encaissé
 * AVANT n'ont pas le champ : ils peuvent changer de devise malgré un
 * historique de paiements — exactement ce que le verrou interdit.
 *
 * Ce que fait la migration, prestataire par prestataire :
 *
 *   1. détecte ceux qui ont au moins une réservation dont l'acompte est
 *      `paid` ou `refunded` (un acompte remboursé a bien été encaissé) ;
 *   2. conserve l'EURO pour ceux qui n'ont pas de devise explicite — elle
 *      n'est PAS écrite : « absent = euro » reste la règle, aucune migration
 *      de données historiques ;
 *   3. pose `currencyLockedAt` à la date du PREMIER encaissement
 *      (`deposit.paidAt` le plus ancien), pour que le verrou raconte la
 *      vérité ; à défaut, `createdAt` de cette réservation ;
 *   4. ne touche JAMAIS à la devise des réservations : elles sont figées à
 *      leur création, et une réservation historique sans devise vaut l'euro
 *      par la règle de lecture (`deviseDeLaReservation`).
 *
 * SÉCURITÉ. Dry-run par défaut : n'écrit rien, imprime ce qu'il ferait.
 * `--apply` écrit, et exige EN PLUS la variable `MIGRATION_CONFIRM=oui`.
 * Honore `FIRESTORE_EMULATOR_HOST` : c'est ainsi qu'il est testé.
 *
 *   node scripts/devises/migration-verrou-devise.mjs             # dry-run
 *   MIGRATION_CONFIRM=oui node scripts/devises/migration-verrou-devise.mjs --apply
 */
import admin from 'firebase-admin';

const APPLY = process.argv.includes('--apply');
if (APPLY && process.env.MIGRATION_CONFIRM !== 'oui') {
  console.error('ARRÊT : --apply exige MIGRATION_CONFIRM=oui. Relancez sans --apply pour un dry-run.');
  process.exit(1);
}
const cible = process.env.FIRESTORE_EMULATOR_HOST
  ? `ÉMULATEUR ${process.env.FIRESTORE_EMULATOR_HOST}`
  : 'PRODUCTION';
console.log(`Cible : ${cible} — mode : ${APPLY ? 'APPLICATION' : 'DRY-RUN (aucune écriture)'}\n`);

/**
 * Identifiants. Contre l'ÉMULATEUR, aucun n'est nécessaire. En PRODUCTION,
 * l'initialisation « projectId seul » s'en remettait aux identifiants par
 * défaut de la machine, qui n'existent pas sur un poste de développement :
 * le script échouait à la première lecture. Ordre de recherche explicite :
 *   1. `SA_PATH` — chemin d'un compte de service ;
 *   2. `service-account.json` à la racine du dépôt (celui du serveur web) ;
 *   3. les identifiants par défaut (`GOOGLE_APPLICATION_CREDENTIALS`, gcloud).
 */
const projectId = process.env.GCLOUD_PROJECT ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'opatam-da04b';
if (admin.apps.length === 0) {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    admin.initializeApp({ projectId });
  } else {
    const { existsSync, readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const candidats = [process.env.SA_PATH, resolve(process.cwd(), 'service-account.json')].filter(Boolean);
    const chemin = candidats.find((c) => existsSync(c));
    if (chemin) {
      const sa = JSON.parse(readFileSync(chemin, 'utf8'));
      admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id ?? projectId });
      console.log(`Identifiants : compte de service ${chemin} (projet ${sa.project_id ?? projectId})`);
    } else {
      console.log('Identifiants : par défaut (GOOGLE_APPLICATION_CREDENTIALS / gcloud) — posez SA_PATH si ça échoue.');
      admin.initializeApp({ projectId });
    }
  }
}
const db = admin.firestore();

const versDate = (v) => (v?.toDate ? v.toDate() : v instanceof Date ? v : v ? new Date(v) : null);

/**
 * Premier encaissement par prestataire, calculé depuis les réservations.
 * Une seule requête par statut : les acomptes payés ou remboursés sont rares.
 */
async function premiersEncaissements() {
  const parPrestataire = new Map();
  for (const statut of ['paid', 'refunded']) {
    const snap = await db.collection('bookings').where('deposit.status', '==', statut).get();
    for (const doc of snap.docs) {
      const b = doc.data();
      if (!b.providerId || !b.deposit) continue;
      const quand = versDate(b.deposit.paidAt) ?? versDate(b.createdAt) ?? new Date();
      const e = parPrestataire.get(b.providerId);
      if (!e || quand < e.quand) {
        parPrestataire.set(b.providerId, { quand, bookingId: doc.id, statut, devise: b.currency ?? null });
      }
    }
  }
  return parPrestataire;
}

export async function planifier() {
  const encaissements = await premiersEncaissements();
  const plan = [];
  for (const [providerId, premier] of encaissements) {
    const snap = await db.collection('providers').doc(providerId).get();
    if (!snap.exists) { plan.push({ providerId, action: 'ignorer', raison: 'prestataire introuvable' }); continue; }
    const p = snap.data();
    if (p.currencyLockedAt) { plan.push({ providerId, action: 'ignorer', raison: 'déjà verrouillé' }); continue; }
    plan.push({
      providerId,
      nom: p.businessName ?? '—',
      // Devise CONSERVÉE : absente = euro, on n'écrit rien. Explicite = gardée.
      devise: p.currency ?? 'EUR (implicite, non écrite)',
      action: 'verrouiller',
      currencyLockedAt: premier.quand,
      justification: `${premier.statut} sur ${premier.bookingId}`,
    });
  }
  return plan;
}

const plan = await planifier();
const aVerrouiller = plan.filter((x) => x.action === 'verrouiller');
for (const x of plan) {
  if (x.action === 'verrouiller') {
    console.log(`VERROUILLER  ${x.providerId}  « ${x.nom} »  devise=${x.devise}  lockedAt=${x.currencyLockedAt.toISOString()}  (${x.justification})`);
  } else {
    console.log(`ignorer      ${x.providerId}  ${x.raison}`);
  }
}
console.log(`\n${aVerrouiller.length} prestataire(s) à verrouiller, ${plan.length - aVerrouiller.length} ignoré(s).`);

if (!APPLY) {
  console.log('DRY-RUN : rien n’a été écrit. Relancez avec --apply et MIGRATION_CONFIRM=oui pour appliquer.');
  process.exit(0);
}

let ecrits = 0;
for (const x of aVerrouiller) {
  // Une seule clé, jamais `currency` : la devise n'est pas migrée.
  await db.collection('providers').doc(x.providerId).update({ currencyLockedAt: x.currencyLockedAt });
  ecrits += 1;
}
console.log(`APPLIQUÉ : ${ecrits} verrou(s) posé(s).`);
