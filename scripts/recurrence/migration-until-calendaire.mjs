/**
 * Migration — `recurrence.until` en date calendaire (« AAAA-MM-JJ »).
 *
 * Les premières versions de la récurrence écrivaient `until` en `Date`
 * (Timestamp en base). Le modèle attend désormais une chaîne. Le dépôt
 * normalise DÉJÀ à la lecture (`normaliserRecurrence`), donc cette migration
 * n'est pas bloquante : elle aligne la base sur le modèle, pour que la
 * tolérance de lecture puisse un jour disparaître.
 *
 * Aucune version récurrente n'a été déployée : les seuls documents concernés
 * seraient nés d'un serveur de développement branché sur la production.
 * D'où le dry-run : on regarde d'abord s'il y en a.
 *
 * La conversion est CELLE du dépôt — `jourCalendaireDepuis`, importée du
 * paquet partagé et testée — pas une copie : la base et la lecture ne
 * peuvent pas diverger.
 *
 * SÉCURITÉ. Dry-run par défaut : n'écrit rien. `--apply` écrit, et exige EN
 * PLUS `MIGRATION_CONFIRM=oui`. Une valeur illisible n'est JAMAIS écrite : elle
 * est listée, à trancher à la main. Honore `FIRESTORE_EMULATOR_HOST`.
 *
 *   node --experimental-strip-types scripts/recurrence/migration-until-calendaire.mjs
 *   MIGRATION_CONFIRM=oui node --experimental-strip-types scripts/recurrence/migration-until-calendaire.mjs --apply
 */
import admin from 'firebase-admin';
import { jourCalendaireDepuis } from '../../packages/shared/src/utils/recurrence.ts';

const APPLY = process.argv.includes('--apply');
if (APPLY && process.env.MIGRATION_CONFIRM !== 'oui') {
  console.error('ARRÊT : --apply exige MIGRATION_CONFIRM=oui. Relancez sans --apply pour un dry-run.');
  process.exit(1);
}
const cible = process.env.FIRESTORE_EMULATOR_HOST ? `ÉMULATEUR ${process.env.FIRESTORE_EMULATOR_HOST}` : 'PRODUCTION';
console.log(`Cible : ${cible} — mode : ${APPLY ? 'APPLICATION' : 'DRY-RUN (aucune écriture)'}\n`);

// Identifiants : aucun sur l'émulateur ; en production SA_PATH, puis le
// compte de service à la racine, puis les identifiants par défaut.
const projectId = process.env.GCLOUD_PROJECT ?? 'opatam-da04b';
if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId });
} else {
  const { existsSync, readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const chemin = [process.env.SA_PATH, resolve(process.cwd(), 'service-account.json')].filter(Boolean).find((c) => existsSync(c));
  if (chemin) {
    const sa = JSON.parse(readFileSync(chemin, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id ?? projectId });
    console.log(`Identifiants : compte de service ${chemin}`);
  } else {
    admin.initializeApp({ projectId });
    console.log('Identifiants : par défaut (GOOGLE_APPLICATION_CREDENTIALS / gcloud).');
  }
}
const db = admin.firestore();

const estCalendaire = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Toutes les périodes de tous les prestataires. Pas de filtre : un groupe de
// collections sans filtre ne demande aucun index, et le volume est modeste.
const snap = await db.collectionGroup('blockedSlots').get();
const aMigrer = [];
const illisibles = [];
let dejaBons = 0;
for (const doc of snap.docs) {
  const r = doc.get('recurrence');
  if (!r || typeof r !== 'object') continue;
  if (estCalendaire(r.until)) { dejaBons += 1; continue; }
  const jour = jourCalendaireDepuis(r.until);
  if (jour) aMigrer.push({ ref: doc.ref, avant: r.until, jour });
  else illisibles.push({ ref: doc.ref, avant: r.until });
}

console.log(`${snap.size} période(s) lue(s) — ${dejaBons} déjà au bon format.`);
for (const x of aMigrer) {
  const avant = x.avant?.toDate ? x.avant.toDate().toISOString() : String(x.avant);
  console.log(`MIGRER    ${x.ref.path}  until ${avant}  →  ${x.jour}`);
}
for (const x of illisibles) {
  console.log(`ILLISIBLE ${x.ref.path}  until ${JSON.stringify(x.avant)}  — laissé tel quel, à trancher`);
}
console.log(`\n${aMigrer.length} à migrer, ${illisibles.length} illisible(s).`);

if (!APPLY) {
  console.log('DRY-RUN : rien n’a été écrit.');
  process.exit(0);
}
for (let i = 0; i < aMigrer.length; i += 400) {
  const batch = db.batch();
  for (const x of aMigrer.slice(i, i + 400)) batch.update(x.ref, { 'recurrence.until': x.jour });
  await batch.commit();
}
console.log(`APPLIQUÉ : ${aMigrer.length} période(s) migrée(s).`);
