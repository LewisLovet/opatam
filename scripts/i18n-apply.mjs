/**
 * Écrit en base les traductions produites à la main.
 *
 * Prend le fichier issu de `i18n-scan.mjs`, complété d'un bloc `translations`
 * par prestation, et le pose dans le champ `i18n` du document.
 *
 * CE QU'IL NE FAIT JAMAIS :
 *   - toucher à `name` ou `description` : le texte du professionnel reste
 *     exactement ce qu'il a saisi ;
 *   - écraser une entrée marquée `edited` : une correction humaine ne se
 *     fait pas remplacer par une machine.
 *
 * L'empreinte est RECALCULÉE à l'écriture, jamais reprise du fichier : si le
 * professionnel a modifié son texte entre le scan et l'application, l'entrée
 * est refusée plutôt que d'associer une traduction à un texte qu'elle ne
 * traduit plus.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/i18n-apply.mjs fichier.json
 *   SA_PATH=… node scripts/i18n-apply.mjs fichier.json --dry     (rien n'est écrit)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry');

if (!file) {
  console.error('Usage : node scripts/i18n-apply.mjs <fichier.json> [--dry]');
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(readFileSync(process.env.SA_PATH ?? 'service-account.json', 'utf-8'))),
  projectId: 'opatam-da04b',
});
const db = getFirestore();

/** Doit rester IDENTIQUE à celle de i18n-scan.mjs. */
function sourceHash(name, description) {
  return createHash('sha1').update(`${name ?? ''}\u0000${description ?? ''}`).digest('hex');
}

const payload = JSON.parse(readFileSync(file, 'utf-8'));
let written = 0;
let skippedStale = 0;
let skippedEdited = 0;
let missing = 0;

for (const prov of payload.providers ?? []) {
  for (const svc of prov.services ?? []) {
    if (!svc.translations) {
      missing++;
      continue;
    }

    const ref = db.collection('providers').doc(prov.providerId).collection('services').doc(svc.serviceId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ✗ ${svc.serviceId} : prestation supprimée depuis le scan`);
      continue;
    }

    const d = snap.data();
    const liveHash = sourceHash(d.name, d.description);

    // Le texte a bougé entre le scan et maintenant : la traduction porterait
    // sur une version périmée.
    if (liveHash !== svc.hash) {
      console.log(`  ⚠ ${d.name} : texte modifié depuis le scan, ignoré`);
      skippedStale++;
      continue;
    }

    // Les entrées retouchées à la main sont reprises telles quelles.
    const existing = d.i18n?.entries ?? {};
    const entries = {};
    for (const [locale, entry] of Object.entries(svc.translations)) {
      if (existing[locale]?.edited) {
        entries[locale] = existing[locale];
        skippedEdited++;
        continue;
      }
      entries[locale] = {
        name: entry.name ?? '',
        description: entry.description ?? '',
      };
    }
    // Une entrée éditée dans une langue absente du fichier survit aussi.
    for (const [locale, entry] of Object.entries(existing)) {
      if (entry?.edited && !entries[locale]) entries[locale] = entry;
    }

    const i18n = {
      sourceLocale: svc.sourceLocale ?? 'fr',
      sourceHash: liveHash,
      sourceText: { name: d.name ?? '', description: d.description ?? '' },
      entries,
      model: svc.model ?? 'manuel',
      translatedAt: Timestamp.now(),
      confidence: typeof svc.confidence === 'number' ? svc.confidence : 1,
      keptTerms: svc.keptTerms ?? [],
    };

    if (dry) {
      console.log(`  · ${d.name} → ${Object.keys(entries).join(', ')}`);
    } else {
      await ref.update({ i18n });
      console.log(`  ✓ ${d.name} → ${Object.keys(entries).join(', ')}`);
    }
    written++;
  }
}

console.log(
  `\n${written} prestation(s) ${dry ? 'seraient écrites' : 'écrites'}` +
    `${skippedStale ? ` · ${skippedStale} ignorée(s) pour texte modifié` : ''}` +
    `${skippedEdited ? ` · ${skippedEdited} entrée(s) éditée(s) préservée(s)` : ''}` +
    `${missing ? ` · ${missing} sans traduction fournie` : ''}`,
);
if (dry) console.log('(--dry : rien n’a été écrit)');
process.exit(0);
