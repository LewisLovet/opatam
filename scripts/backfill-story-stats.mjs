/**
 * Rattrapage des compteurs de stories (provider.stats.stories) depuis
 * `storyEvents` : shared, lastSharedAt, byContent, byWeek, byMonth.
 *
 * À lancer UNE fois après le déploiement de recordStoryShare (qui tient ces
 * compteurs pour les partages suivants). Idempotent : recalcule tout depuis
 * les événements et remplace le bloc `stats.stories` de chaque prestataire.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/backfill-story-stats.mjs            # simulation
 *   SA_PATH="$PWD/service-account.json" node scripts/backfill-story-stats.mjs --apply    # écrit
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const apply = process.argv.includes('--apply');
const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();

// Mêmes clés que packages/shared/src/utils/storyGoals.ts (copie volontaire :
// ce script tourne sans build du monorepo).
function weekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const events = await db.collection('storyEvents').get();
const parProvider = new Map();
for (const doc of events.docs) {
  const e = doc.data();
  const at = e.createdAt?.toDate?.();
  if (!e.providerId || !at) continue;
  const p = parProvider.get(e.providerId) ?? { shared: 0, lastSharedAt: null, byContent: {}, byWeek: {}, byMonth: {} };
  p.shared++;
  if (!p.lastSharedAt || at > p.lastSharedAt) p.lastSharedAt = at;
  const c = typeof e.content === 'string' ? e.content : 'none';
  p.byContent[c] = (p.byContent[c] ?? 0) + 1;
  p.byWeek[weekKey(at)] = (p.byWeek[weekKey(at)] ?? 0) + 1;
  p.byMonth[monthKey(at)] = (p.byMonth[monthKey(at)] ?? 0) + 1;
  parProvider.set(e.providerId, p);
}

console.log(`${events.size} événements → ${parProvider.size} prestataires${apply ? '' : ' (simulation, rien n’est écrit)'}`);
let ecrits = 0;
for (const [providerId, p] of parProvider) {
  const ref = db.collection('providers').doc(providerId);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`↷ ${providerId} — prestataire supprimé, ignoré`);
    continue;
  }
  console.log(`${apply ? '✓' : '·'} ${snap.data().businessName ?? providerId} — ${p.shared} partages, semaines ${Object.keys(p.byWeek).length}, types ${JSON.stringify(p.byContent)}`);
  if (apply) {
    await ref.update({
      'stats.stories': { ...p, lastSharedAt: Timestamp.fromDate(p.lastSharedAt) },
    });
    ecrits++;
  }
}
console.log(apply ? `\n${ecrits} prestataires mis à jour.` : '\nRelancer avec --apply pour écrire.');
