/**
 * Remet à zéro la conversation de support d'UN prestataire (test/démo).
 *
 * Sauvegarde d'abord le doc de conversation + tous ses messages dans
 * scripts/.backup-supportChat-<providerId>-<date>.json, puis supprime tout
 * (messages + doc supportChats/{providerId}). Le prochain message recréera
 * le doc avec des compteurs neufs via onSupportMessageCreate.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/reset-support-chat.mjs --pid <providerId>
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';

const pidIdx = process.argv.indexOf('--pid');
const pid = pidIdx > -1 ? process.argv[pidIdx + 1] : null;
if (!pid) {
  console.error('Passer --pid <providerId>');
  process.exit(1);
}

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();

const ref = db.collection('supportChats').doc(pid);
const chatSnap = await ref.get();
const msgs = await ref.collection('messages').orderBy('createdAt').get();

const iso = (v) => (v && typeof v.toDate === 'function' ? v.toDate().toISOString() : v);
const backup = {
  providerId: pid,
  chat: chatSnap.exists ? chatSnap.data() : null,
  messages: msgs.docs.map((d) => ({ id: d.id, ...d.data() })),
};
const file = `scripts/.backup-supportChat-${pid}-${new Date().toISOString().slice(0, 10)}.json`;
writeFileSync(file, JSON.stringify(backup, (k, v) => iso(v), 2));
console.log(`sauvegarde : ${file} (${msgs.size} messages)`);

const batch = db.batch();
msgs.docs.forEach((d) => batch.delete(d.ref));
if (chatSnap.exists) batch.delete(ref);
await batch.commit();

const reste = await ref.collection('messages').get();
console.log(`supprimés : ${msgs.size} messages + doc de conversation`);
console.log(`reste : ${reste.size} messages | chat existe : ${(await ref.get()).exists}`);
