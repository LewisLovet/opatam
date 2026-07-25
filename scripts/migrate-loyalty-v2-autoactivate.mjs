/**
 * Migration fidélité v2 — auto-activation des cartes entamées.
 *
 * Décision produit 2026-07-24 : les clients qui cumulaient déjà (système
 * auto depuis le 20/07) gardent une carte ACTIVE (pas de régression) ;
 * seuls les nouveaux passent par le bouton « Activer ma carte ».
 * promoEmailsOptIn reste false : pas de consentement marketing implicite
 * (RGPD) — ils cocheront depuis leur carte dans l'app.
 *
 * À lancer EN MÊME TEMPS que le déploiement de la route gatée (sinon les
 * cartes armées existantes cessent de consommer leur récompense).
 * Idempotent : ne touche que les docs sans loyaltyActivatedAt.
 *
 * Usage : SA_PATH="$PWD/service-account.json" node scripts/migrate-loyalty-v2-autoactivate.mjs
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();

const snap = await db.collection('providerClients').where('loyaltyConfirmedCount', '>=', 1).get();
let migrated = 0;
for (const doc of snap.docs) {
  if (doc.data().loyaltyActivatedAt) continue;
  await doc.ref.update({ loyaltyActivatedAt: new Date(), promoEmailsOptIn: false });
  migrated++;
}
console.log(`cartes entamées: ${snap.size} | auto-activées: ${migrated} (déjà actives: ${snap.size - migrated})`);
