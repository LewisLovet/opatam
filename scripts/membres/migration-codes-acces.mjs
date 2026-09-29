/**
 * Migration : sortir les codes d'accès au planning des fiches membres.
 *
 * Pourquoi : la fiche d'un membre est en lecture publique (la page du salon
 * affiche l'équipe) et portait son code d'accès — n'importe qui pouvait
 * ouvrir le planning de n'importe quel membre. Chaque code part dans
 * `memberAccessCodes/{code}` (lisible par le gérant seul) et est effacé de
 * la fiche, dans la même transaction.
 *
 * Le rangement exécuté est `rangerCodeAcces` tel que compilé dans
 * `functions/dist` — le MÊME code que le trigger `onMemberWriteAccessCode`,
 * pas une copie. Lancer `npm --prefix functions run build` avant.
 *
 * Les codes ne changent pas (les e-mails déjà reçus restent valables), sauf
 * collision entre deux membres ou code illisible : ce membre-là reçoit un
 * code neuf, signalé dans le rapport.
 *
 * SÉCURITÉ. Dry-run par défaut : lit, n'écrit rien, dit ce qui serait fait.
 * `--apply` écrit, et exige EN PLUS `MIGRATION_CONFIRM=oui`. Relançable :
 * un code déjà rangé n'est pas recréé. Honore `FIRESTORE_EMULATOR_HOST`.
 * Les codes sont MASQUÉS dans la sortie.
 *
 *   node scripts/membres/migration-codes-acces.mjs [--provider <id>]
 *   MIGRATION_CONFIRM=oui node scripts/membres/migration-codes-acces.mjs --apply
 */
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
// firebase-admin chargé DEPUIS functions/ : le code compilé des functions
// doit partager la même instance du SDK.
const req = createRequire(resolve(racine, 'functions/package.json'));
const admin = req('firebase-admin');

const arg = (nom) => {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const seulement = arg('--provider');
const APPLY = process.argv.includes('--apply');
if (APPLY && process.env.MIGRATION_CONFIRM !== 'oui') {
  console.error('ARRÊT : --apply exige MIGRATION_CONFIRM=oui. Relancez sans --apply pour un dry-run.');
  process.exit(1);
}
const dist = resolve(racine, 'functions/dist');
if (!existsSync(resolve(dist, 'lib/codesAcces.js'))) {
  console.error('ARRÊT : functions/dist absent ou ancien. Lancez d’abord : npm --prefix functions run build');
  process.exit(1);
}

const projectId = process.env.GCLOUD_PROJECT ?? 'opatam-da04b';
if (process.env.FIRESTORE_EMULATOR_HOST) {
  admin.initializeApp({ projectId });
} else {
  const chemin = [process.env.SA_PATH, resolve(racine, 'service-account.json')].filter(Boolean).find((c) => existsSync(c));
  if (!chemin) {
    console.error('ARRÊT : aucun compte de service (SA_PATH ou service-account.json à la racine).');
    process.exit(1);
  }
  const sa = JSON.parse(readFileSync(chemin, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id ?? projectId });
}
const db = admin.firestore();
const cible = process.env.FIRESTORE_EMULATOR_HOST ? `ÉMULATEUR ${process.env.FIRESTORE_EMULATOR_HOST}` : 'PRODUCTION';
const { rangerCodeAcces } = req(resolve(dist, 'lib/codesAcces.js'));

/** « JEAN-AB12 » → « JEA••••••» : la sortie ne doit rien révéler. */
const masquer = (c) => (typeof c === 'string' && c ? c.slice(0, 3) + '•'.repeat(Math.max(0, c.length - 3)) : '—');

console.log(`Cible : ${cible} — mode : ${APPLY ? 'APPLICATION' : 'DRY-RUN (aucune écriture)'}${seulement ? ` — salon ${seulement}` : ''}\n`);

const fiches = (await db.collectionGroup('members').get()).docs
  .map((d) => ({ providerId: d.ref.parent.parent?.id, memberId: d.id, nom: d.get('name'), code: d.get('accessCode') }))
  .filter((f) => f.providerId && (!seulement || f.providerId === seulement));
const avecCode = fiches.filter((f) => typeof f.code === 'string' && f.code);
console.log(`${fiches.length} fiche(s) membre, dont ${avecCode.length} portant encore un code.\n`);

const bilan = {};
const aSignaler = [];
// Registre des codes attribués par un DRY-RUN (rien n'est écrit) : sans lui,
// deux membres portant le même code paraîtraient tous deux « rangés ».
const simules = APPLY ? undefined : new Map();
for (const f of avecCode) {
  const r = await rangerCodeAcces(db, f.providerId, f.memberId, { ecrire: APPLY, simules });
  bilan[r.action] = (bilan[r.action] ?? 0) + 1;
  if (r.action === 'collision' || r.action === 'invalide') {
    aSignaler.push(`  ${r.action.toUpperCase()}  ${f.providerId}/${f.memberId} (« ${f.nom} ») : ${masquer(r.ancien)} → nouveau code ${masquer(r.code)}`);
  }
}

console.log('Bilan :', JSON.stringify(bilan));
if (aSignaler.length) {
  console.log(`\n${aSignaler.length} membre(s) recevront un NOUVEAU code (à leur renvoyer) :`);
  console.log(aSignaler.join('\n'));
}

if (!APPLY) {
  console.log('\nDRY-RUN : rien n’a été écrit.');
  process.exit(0);
}
const restantes = (await db.collectionGroup('members').get()).docs.filter(
  (d) => typeof d.get('accessCode') === 'string' && d.get('accessCode') && (!seulement || d.ref.parent.parent?.id === seulement),
).length;
const ranges = (await db.collection('memberAccessCodes').get()).size;
console.log(`\nAPPLIQUÉ. Fiches portant encore un code : ${restantes} (attendu 0). Codes rangés en tout : ${ranges}.`);
process.exit(restantes === 0 ? 0 : 2);
