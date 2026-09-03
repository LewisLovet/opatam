/**
 * One-off : réattribution des résas futures de la Coiffeuse Masquée.
 *
 * Contexte (diagnostic 2026-09-01) : elle avait créé un second membre
 * « (femme) » pour elle-même, puis l'a désactivé — ses résas futures sont
 * restées sur ce membre désactivé et ne bloquent pas l'agenda du membre
 * principal (le moteur de conflits filtre par memberId) : fenêtre de double
 * réservation ouverte tant que la bascule n'est pas faite.
 *
 * Le script enchaîne les trois précautions validées :
 *   1. re-vérification des collisions (les données existantes ne repassent
 *      jamais par le moteur de conflits) — abandon si chevauchement ;
 *   2. bascule memberId + memberName ENSEMBLE (memberName est dénormalisé :
 *      rappels e-mail « avec {memberName} » lus au moment de l'envoi) ;
 *   3. recalcul du cache provider.nextAvailableSlot (onBookingWrite ignore
 *      un changement de membre seul, et le cache est calculé sur le membre
 *      principal dont l'occupation vient de changer).
 *
 * Aucun e-mail ni push ne part : les triggers n'envoient que sur transition
 * de statut, changement de date ou de prestations — vérifié.
 *
 * Usage (depuis functions/) :
 *   SA_PATH="$PWD/../service-account.json" pnpm exec tsx scripts/reassignCoiffeuseMasquee.ts           # dry-run
 *   SA_PATH="$PWD/../service-account.json" pnpm exec tsx scripts/reassignCoiffeuseMasquee.ts --apply   # exécute
 */

import { readFileSync } from 'fs';
import * as admin from 'firebase-admin';
import { calculateNextAvailableSlot } from '../src/utils/calculateNextAvailableSlot';

const PROVIDER_ID = 'fFqMosQzIgPj3mfEgHOttZUIjtx1'; // Coiffeuse Masquée
const OLD_MEMBER_ID = 'dbzRkzmEtDHcQhdUYLPo'; // « (femme) », désactivé
const NEW_MEMBER_ID = 'NUjfUYtKJK0AJ4KKyxb3'; // membre principal actif

const BLOCKING_STATUSES = ['confirmed', 'pending', 'pending_payment'];
const APPLY = process.argv.includes('--apply');

const sa = JSON.parse(readFileSync(process.env.SA_PATH!, 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa), projectId: 'opatam-da04b' });
const db = admin.firestore();

function fmt(t: admin.firestore.Timestamp): string {
  return t.toDate().toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
}

async function main() {
  // ── Les deux membres : cible active obligatoire, nom pour la dénorme ──
  const membersRef = db.collection('providers').doc(PROVIDER_ID).collection('members');
  const [oldSnap, newSnap] = await Promise.all([
    membersRef.doc(OLD_MEMBER_ID).get(),
    membersRef.doc(NEW_MEMBER_ID).get(),
  ]);
  if (!oldSnap.exists || !newSnap.exists) throw new Error('Membre introuvable — abandon.');
  const newMember = newSnap.data()!;
  if (newMember.isActive !== true) throw new Error('Le membre cible n’est pas actif — abandon.');
  const newName: string = newMember.name;
  console.log(`Source  : « ${oldSnap.data()!.name} » (${OLD_MEMBER_ID}, isActive=${oldSnap.data()!.isActive})`);
  console.log(`Cible   : « ${newName} » (${NEW_MEMBER_ID}, actif)\n`);

  // ── Résas du prestataire — égalité seule puis filtre mémoire (règle
  //    projet : pas d'index composite Firestore) ──
  const all = await db.collection('bookings').where('providerId', '==', PROVIDER_ID).get();
  const now = admin.firestore.Timestamp.now();
  const futureActive = all.docs.filter((d) => {
    const b = d.data();
    return BLOCKING_STATUSES.includes(b.status) && b.datetime?.toMillis?.() > now.toMillis();
  });
  const toMove = futureActive.filter((d) => d.data().memberId === OLD_MEMBER_ID);
  const target = futureActive.filter((d) => d.data().memberId === NEW_MEMBER_ID);
  console.log(`Résas futures actives : ${futureActive.length} (à basculer : ${toMove.length}, déjà sur la cible : ${target.length})\n`);

  if (toMove.length === 0) {
    console.log('Rien à basculer — terminé.');
    return;
  }

  // ── Précaution 1 : collisions [start, end) contre l'agenda cible ET
  //    entre les résas déplacées elles-mêmes ──
  const interval = (d: FirebaseFirestore.QueryDocumentSnapshot) => {
    const b = d.data();
    const start = b.datetime.toMillis();
    const end = b.endDatetime?.toMillis?.() ?? start + (b.duration ?? 0) * 60_000;
    return { id: d.id, start, end, b };
  };
  const moved = toMove.map(interval);
  const fixed = target.map(interval);
  const collisions: string[] = [];
  for (const m of moved) {
    for (const f of [...fixed, ...moved.filter((x) => x.id !== m.id)]) {
      if (m.start < f.end && f.start < m.end) {
        collisions.push(
          `  ✗ ${m.id} (${fmt(m.b.datetime)}, ${m.b.clientInfo?.firstName ?? '?'}) ↔ ${f.id} (${fmt(f.b.datetime)})`,
        );
      }
    }
  }
  if (collisions.length > 0) {
    console.error('COLLISIONS DÉTECTÉES — aucune écriture effectuée :');
    for (const c of [...new Set(collisions)]) console.error(c);
    process.exitCode = 1;
    return;
  }
  console.log('Aucune collision — la bascule est sûre.\n');

  for (const m of moved) {
    console.log(
      `  → ${m.id} · ${fmt(m.b.datetime)} · ${m.b.serviceName ?? m.b.items?.[0]?.serviceName ?? '?'} · ${m.b.clientInfo?.firstName ?? ''} ${m.b.clientInfo?.lastName ?? ''} · « ${m.b.memberName} » → « ${newName} »`,
    );
  }

  if (!APPLY) {
    console.log('\nDRY-RUN — relancer avec --apply pour exécuter.');
    return;
  }

  // ── Précaution 2 : memberId + memberName ensemble, en un seul batch ──
  const batch = db.batch();
  for (const m of moved) {
    batch.update(db.collection('bookings').doc(m.id), {
      memberId: NEW_MEMBER_ID,
      memberName: newName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`\n${moved.length} réservations basculées.`);

  // ── Précaution 3 : recalcul du cache « prochain créneau » ──
  const next = await calculateNextAvailableSlot(PROVIDER_ID);
  await db.collection('providers').doc(PROVIDER_ID).update({
    nextAvailableSlot: next ? admin.firestore.Timestamp.fromDate(next) : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`nextAvailableSlot recalculé : ${next ? next.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : 'null'}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
