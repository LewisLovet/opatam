/**
 * Message d'accueil de la messagerie Opatam — badge sans push.
 *
 * Écrit un premier message `from: 'admin'` avec `silent: true` dans le chat
 * de chaque prestataire : la Cloud Function onSupportMessageCreate tient les
 * compteurs (le pro voit le badge « 1 » sur l'icône du hero, le menu Plus et
 * la bulle web) mais n'envoie NI push NI e-mail. Objectif : faire découvrir
 * la messagerie et ouvrir le dialogue (conversion), sans spammer.
 *
 * ⚠️ PRÉREQUIS : le trigger avec le support `silent` doit être DÉPLOYÉ avant
 * d'exécuter, sinon chaque message d'accueil part en notification push.
 *
 * Idempotent : un prestataire dont le chat contient déjà des messages est
 * ignoré (on n'écrase pas une conversation en cours, on ne double pas
 * l'accueil).
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/seed-support-welcome.mjs --pid <providerId>  # un compte (test)
 *   SA_PATH="$PWD/service-account.json" node scripts/seed-support-welcome.mjs --all               # tous les prestataires
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const MESSAGE_ACCUEIL = `Bienvenue sur votre messagerie Opatam 👋

Ici, vous parlez directement avec l'équipe : une question sur votre page, vos créneaux, les acomptes, la carte de fidélité — écrivez-nous, un humain vous répond.

C'est aussi le bon endroit pour nous dire ce qui vous manque : vos idées font évoluer l'application.`;

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();

const all = process.argv.includes('--all');
const pidIdx = process.argv.indexOf('--pid');
const pid = pidIdx > -1 ? process.argv[pidIdx + 1] : null;
if (!all && !pid) {
  console.error('Passer --pid <providerId> ou --all');
  process.exit(1);
}

async function accueillir(providerId, businessName) {
  const dejaDesMessages = await db
    .collection('supportChats')
    .doc(providerId)
    .collection('messages')
    .limit(1)
    .get();
  if (!dejaDesMessages.empty) {
    console.log(`↷ ${businessName ?? providerId} — conversation existante, ignoré`);
    return false;
  }
  await db.collection('supportChats').doc(providerId).collection('messages').add({
    from: 'admin',
    authorUid: 'opatam-accueil',
    text: MESSAGE_ACCUEIL,
    silent: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`✓ ${businessName ?? providerId} — accueil envoyé (badge, sans push)`);
  return true;
}

if (pid) {
  const prov = await db.collection('providers').doc(pid).get();
  if (!prov.exists) {
    console.error('Provider introuvable:', pid);
    process.exit(1);
  }
  await accueillir(pid, prov.data().businessName);
} else {
  const provs = await db.collection('providers').select('businessName').get();
  console.log(`${provs.size} prestataires…`);
  let envoyes = 0;
  for (const d of provs.docs) {
    if (await accueillir(d.id, d.data().businessName)) envoyes++;
  }
  console.log(`\n${envoyes} messages d'accueil envoyés.`);
}
process.exit(0);
