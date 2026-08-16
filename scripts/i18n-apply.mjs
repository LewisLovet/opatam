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
const allowPromoNotify = args.includes('--allow-promo-notify');

if (!file) {
  console.error('Usage : node scripts/i18n-apply.mjs <fichier.json> [--dry] [--allow-promo-notify]');
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

/** Les seules langues que les surfaces publiques savent lire. */
const LOCALES = ['fr', 'en', 'it', 'pt', 'de'];

/**
 * La langue source est la seule métadonnée que ce script ne peut pas
 * reconstituer. `getServiceText` renvoie le texte ORIGINAL quand la langue
 * demandée est la langue source : une valeur par défaut ferait donc lire
 * l'anglais aux francophones sur une prestation écrite en anglais — sans
 * qu'aucune erreur ne soit visible nulle part. Mieux vaut refuser d'écrire.
 *
 * Elle n'est PAS restreinte à `LOCALES` : un professionnel peut écrire en
 * espagnol sans que le site soit traduit en espagnol. Seule exigence, un
 * code de langue plausible.
 */
function badSourceLocale(value) {
  return typeof value !== 'string' || !/^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/.test(value);
}

const payload = JSON.parse(readFileSync(file, 'utf-8'));
let written = 0;
let skippedNoSource = 0;
let droppedEntries = 0;
let skippedPromo = 0;
let skippedStale = 0;
let skippedEdited = 0;
let missing = 0;

for (const prov of payload.providers ?? []) {
  for (const svc of prov.services ?? []) {
    if (!svc.translations) {
      missing++;
      continue;
    }

    // Avant toute lecture : sans langue source, la traduction serait écrite
    // mais jamais affichée dans la bonne langue. Voir `badSourceLocale`.
    if (badSourceLocale(svc.sourceLocale)) {
      console.log(
        `  ✗ ${svc.current?.name ?? svc.serviceId} : sourceLocale manquante ou invalide ` +
          `(${JSON.stringify(svc.sourceLocale)}), ignorée`,
      );
      skippedNoSource++;
      continue;
    }

    const ref = db.collection('providers').doc(prov.providerId).collection('services').doc(svc.serviceId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ✗ ${svc.serviceId} : prestation supprimée depuis le scan`);
      continue;
    }

    const d = snap.data();

    // ⚠️ POSER UNE TRADUCTION EST UNE ÉCRITURE, ET UNE ÉCRITURE RÉVEILLE
    // `onServiceDiscountPromoEmail`, qui écoute providers/*/services/*.
    //
    // Le déclencheur ne regarde pas CE qui a changé : il rejoue sa décision
    // sur l'état d'après. Sur une prestation dont le pro a demandé
    // « prévenir mes clients » et dont l'offre n'a jamais été notifiée, le
    // registre d'idempotence est vide — rien ne retient l'envoi. Traduire un
    // libellé enverrait donc une campagne promotionnelle aux clientes du
    // professionnel, en son nom, sans qu'il l'ait décidé aujourd'hui.
    //
    // Constaté le 2026-08-16 : quatre prestations dans ce cas, promo de 10 %
    // sans date de fin, prestataire publié. Zéro destinataire inscrit ce
    // jour-là — donc rien n'est parti — mais c'est une propriété de la base
    // à l'instant T, pas une garantie.
    //
    // Ces prestations se traduisent depuis l'espace pro, ou ici une fois
    // l'option retirée, ou avec --allow-promo-notify en connaissance de cause.
    if (d.discount?.notifyLoyaltyClients === true && !allowPromoNotify) {
      console.log(
        `  ✗ ${d.name} : promo « prévenir mes clients » active — écriture ignorée ` +
          `(elle déclencherait l'envoi). --allow-promo-notify pour passer outre.`,
      );
      skippedPromo++;
      continue;
    }

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
      // Une entrée qu'aucune surface ne lira jamais ne doit pas être écrite :
      // stockée, elle passerait pour du travail fait. Trois cas :
      //   - une langue hors des cinq servies (faute de frappe, langue en trop) ;
      //   - la langue source, que `getServiceText` court-circuite ;
      //   - une entrée entièrement vide, qui retombe sur l'original.
      if (!LOCALES.includes(locale)) {
        console.log(`  · ${d.name} : « ${locale} » n'est pas une langue servie, entrée ignorée`);
        droppedEntries++;
        continue;
      }
      if (locale === svc.sourceLocale) {
        console.log(`  · ${d.name} : entrée « ${locale} » = langue source, jamais lue, ignorée`);
        droppedEntries++;
        continue;
      }
      const name = entry?.name ?? '';
      const description = entry?.description ?? '';
      if (!name && !description) {
        console.log(`  · ${d.name} : entrée « ${locale} » vide, ignorée`);
        droppedEntries++;
        continue;
      }

      if (existing[locale]?.edited) {
        entries[locale] = existing[locale];
        skippedEdited++;
        continue;
      }
      entries[locale] = { name, description };
    }
    // Une entrée éditée dans une langue absente du fichier survit aussi.
    for (const [locale, entry] of Object.entries(existing)) {
      if (entry?.edited && !entries[locale]) entries[locale] = entry;
    }

    // Écrire malgré un lot entièrement écarté poserait `sourceHash` sur le
    // texte courant : le scan suivant considérerait la prestation à jour et
    // elle ne réapparaîtrait plus jamais dans la liste à traduire.
    if (Object.keys(entries).length === 0) {
      console.log(`  ✗ ${d.name} : aucune traduction exploitable, rien écrit`);
      continue;
    }

    const i18n = {
      sourceLocale: svc.sourceLocale,
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
    `${skippedNoSource ? ` · ${skippedNoSource} sans langue source` : ''}` +
    `${skippedPromo ? ` · ${skippedPromo} écartée(s) : promo notifiable` : ''}` +
    `${droppedEntries ? ` · ${droppedEntries} entrée(s) inutilisable(s) écartée(s)` : ''}` +
    `${missing ? ` · ${missing} sans traduction fournie` : ''}`,
);
if (dry) console.log('(--dry : rien n’a été écrit)');
process.exit(0);
