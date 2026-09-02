/**
 * Interrupteur du chat de support — crée/ajuste le doc `config/supportChat`.
 *
 *   { enabledForAll: boolean, allowedProviderIds: string[] }
 *
 * Le chat (bulle web /pro + Messagerie Opatam dans l'app) n'est visible que
 * pour les comptes listés — les admins plateforme le voient toujours côté
 * web. Pour l'ouvrir à tout le monde : passer enabledForAll à true dans la
 * console Firebase (ou relancer avec --all), sans aucun redéploiement.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/setup-support-chat-flag.mjs
 *   SA_PATH=… node scripts/setup-support-chat-flag.mjs --all   # ouvre à tous
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Salon de Coiffure — le compte de test/démo qui sert à valider avant ouverture.
const SALON_DE_COIFFURE = '67urFFyBFlUHd9Oa1QF8C2fcQha2';

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();

const enabledForAll = process.argv.includes('--all');

await db.doc('config/supportChat').set(
  {
    enabledForAll,
    allowedProviderIds: [SALON_DE_COIFFURE],
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
);

const doc = await db.doc('config/supportChat').get();
console.log('config/supportChat →', JSON.stringify(doc.data(), null, 2));
