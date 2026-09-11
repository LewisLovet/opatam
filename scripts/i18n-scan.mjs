/**
 * Que reste-t-il à traduire ?
 *
 * Compare l'empreinte du texte actuel de chaque prestation à celle stockée
 * lors de sa dernière traduction, et produit la liste du travail à faire.
 *
 * POURQUOI UN SCRIPT ET NON UN DÉCLENCHEUR : tant que la traduction est
 * manuelle, un déclencheur ne ferait qu'écrire un drapeau que ce script
 * recalcule en une passe. Il faudrait le déployer, le surveiller, et se
 * prémunir de sa boucle — pour rien. Le jour où la traduction devient
 * automatique, le déclencheur remplacera ce script sans toucher au modèle.
 *
 * Il ne MODIFIE RIEN : lecture seule, exécutable à tout moment.
 *
 * Sortie :
 *   - un résumé lisible en console, groupé par prestataire
 *   - un fichier JSON prêt à traduire, avec le contexte métier de chaque
 *     prestation (catégorie, nom commercial, prestations voisines) — c'est
 *     ce contexte qui fait la différence entre « Balayage » traduit au hasard
 *     et « Balayage » reconnu comme une technique de coloration.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/i18n-scan.mjs
 *   SA_PATH=… node scripts/i18n-scan.mjs --slug braidztouch-1
 *   SA_PATH=… node scripts/i18n-scan.mjs --out /tmp/a-traduire.json
 *   SA_PATH=… node scripts/i18n-scan.mjs --slug studio-harmonie --include-test
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { categoryHash, choicesHash, hasChoiceTexts, listChoiceTexts } from './lib/choice-texts.mjs';

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const onlySlug = argOf('--slug');
// Les comptes de démonstration sont exclus par défaut — leur contenu n'est
// pas destiné au public. L'option sert à éprouver la chaîne complète sans
// toucher au catalogue d'un professionnel réel.
const includeTest = args.includes('--include-test');
const outPath = argOf('--out') ?? '/tmp/i18n-a-traduire.json';

initializeApp({
  credential: cert(JSON.parse(readFileSync(process.env.SA_PATH ?? 'service-account.json', 'utf-8'))),
  projectId: 'opatam-da04b',
});
const db = getFirestore();

/** Langues servies par les surfaces publiques. */
const LOCALES = ['fr', 'en', 'it', 'pt', 'de'];

/**
 * Empreinte du texte source. Le séparateur nul évite qu'un déplacement de
 * caractères entre le nom et la description produise la même empreinte.
 * Cette fonction devra être RECOPIÉE À L'IDENTIQUE le jour où le
 * déclencheur prendra le relais — sinon tout serait considéré comme périmé.
 */
function sourceHash(name, description) {
  return createHash('sha1').update(`${name ?? ''}\u0000${description ?? ''}`).digest('hex');
}

/** Ce que le professionnel a écrit, aujourd'hui. */
const textOf = (d) => ({ name: d.name ?? '', description: d.description ?? '' });

const providers = await db.collection('providers').get();
const todo = [];
const lines = [];
let scanned = 0;
let upToDate = 0;
let choicesOnly = 0;
let categoriesScanned = 0;
let categoriesUpToDate = 0;

for (const p of providers.docs) {
  const prov = p.data();
  if (prov.isTest && !includeTest) continue;
  if (onlySlug && prov.slug !== onlySlug) continue;

  const services = await p.ref.collection('services').get();
  const items = [];

  // Les prestations voisines servent de contexte au traducteur : elles
  // révèlent le vocabulaire du salon mieux qu'une catégorie générique.
  const siblings = services.docs.map((s) => s.data().name).filter(Boolean);

  for (const s of services.docs) {
    const d = s.data();
    if (d.isActive === false) continue;
    const text = textOf(d);
    if (!text.name && !text.description) continue;

    scanned++;
    const hash = sourceHash(text.name, text.description);
    const i18n = d.i18n;

    // Les CHOIX (variations, valeurs, options, champs) ont leur propre
    // empreinte : une prestation au texte à jour peut avoir des choix
    // jamais traduits, ou modifiés depuis.
    const withChoices = hasChoiceTexts(d);
    const cHash = withChoices ? choicesHash(d) : null;
    const textUpToDate = i18n?.sourceHash === hash;
    const choicesUpToDate = !withChoices || i18n?.choicesHash === cHash;

    if (textUpToDate && choicesUpToDate) {
      upToDate++;
      continue;
    }
    if (textUpToDate) choicesOnly++;

    const entry = {
      providerId: p.id,
      serviceId: s.id,
      // `never`      = jamais traduite.
      // `incomplete` = traduite pour le texte actuel, mais pas dans toutes
      //                les langues (empreinte laissée à `null` à dessein).
      // `stale`      = le texte a changé depuis la traduction.
      // `choices-only` = texte à jour, seuls les choix sont à traiter.
      status: textUpToDate ? 'choices-only' : !i18n ? 'never' : i18n.sourceHash === null ? 'incomplete' : 'stale',
      current: text,
      hash,
      // Les choix à traduire, à plat (kind/id/parentId/name/description/values).
      // Absent quand la prestation n'en a pas, ou qu'ils sont à jour.
      ...(withChoices && !choicesUpToDate
        ? {
            choices: {
              hash: cHash,
              status: !Object.values(i18n?.entries ?? {}).some((e) => e?.choices)
                ? 'never'
                : i18n?.choicesHash === null
                  ? 'incomplete'
                  : 'stale',
              items: listChoiceTexts(d),
              existingLocales: Object.entries(i18n?.entries ?? {})
                .filter(([, e]) => e?.choices)
                .map(([k]) => k),
            },
          }
        : {}),
      // LANGUE DANS LAQUELLE LE PROFESSIONNEL A ÉCRIT, à renseigner en
      // traduisant. Elle ne se devine pas depuis le compte : un même
      // catalogue mélange les langues (Salon de Coiffure a des prestations
      // en français et d'autres en anglais).
      //
      // Ce n'est pas une métadonnée décorative : `getServiceText` renvoie le
      // texte ORIGINAL quand la langue demandée est la langue source. La
      // supposer française sur une prestation écrite en anglais ferait lire
      // l'anglais aux visiteurs francophones — traduction en base ou non.
      // `i18n-apply.mjs` refuse donc d'écrire tant qu'elle vaut null.
      sourceLocale: i18n?.sourceLocale ?? null,
    };

    if (i18n) {
      // Ce qui a changé, champ par champ : c'est ce qui permet de ne
      // retraduire que la moitié touchée plutôt que l'entrée entière.
      const was = i18n.sourceText ?? {};
      entry.previous = { name: was.name ?? null, description: was.description ?? null };
      entry.changed = [
        was.name !== text.name ? 'name' : null,
        was.description !== text.description ? 'description' : null,
      ].filter(Boolean);
      entry.existingLocales = Object.keys(i18n.entries ?? {});
      // Une entrée retouchée à la main ne doit pas être réécrite.
      entry.protectedLocales = Object.entries(i18n.entries ?? {})
        .filter(([, v]) => v?.edited)
        .map(([k]) => k);
      // Ce qui reste à faire, tel que l'application l'a laissé.
      entry.pendingLocales = i18n.pendingLocales ?? null;
      // Les entrées présentes MAIS qui traduisent une autre version du texte.
      // C'est ici qu'apparaît une correction humaine devenue fausse : elle est
      // protégée de l'écrasement, donc elle survit — et il faut bien que
      // quelqu'un finisse par la relire.
      entry.staleLocales = Object.entries(i18n.entries ?? {})
        .filter(([, v]) => v?.sourceHash !== hash)
        .map(([k]) => k);
    }

    items.push(entry);
  }

  // Catégories de prestations créées par le pro (titres de sections de la
  // page publique) — même logique d'empreinte, sur le seul nom.
  const catSnap = await p.ref.collection('serviceCategories').get();
  const categories = [];
  for (const c of catSnap.docs) {
    const cd = c.data();
    if (cd.isActive === false || !cd.name) continue;
    categoriesScanned++;
    const h = categoryHash(cd.name);
    if (cd.i18n?.sourceHash === h) {
      categoriesUpToDate++;
      continue;
    }
    categories.push({
      categoryId: c.id,
      status: !cd.i18n ? 'never' : cd.i18n.sourceHash === null ? 'incomplete' : 'stale',
      current: { name: cd.name },
      hash: h,
      sourceLocale: cd.i18n?.sourceLocale ?? null,
      existingLocales: Object.keys(cd.i18n?.entries ?? {}),
    });
  }

  if (items.length === 0 && categories.length === 0) continue;

  todo.push({
    providerId: p.id,
    businessName: prov.businessName,
    slug: prov.slug,
    category: prov.category,
    // Contexte pour le traducteur, pas pour l'affichage.
    otherServices: siblings.slice(0, 20),
    services: items,
    categories,
  });

  const never = items.filter((i) => i.status === 'never').length;
  const partial = items.filter((i) => i.status === 'incomplete').length;
  const onlyChoices = items.filter((i) => i.status === 'choices-only').length;
  const stale = items.length - never - partial - onlyChoices;
  const parts = [
    never ? `${never} jamais traduites` : null,
    partial ? `${partial} incomplètes` : null,
    stale ? `${stale} modifiées` : null,
    onlyChoices ? `${onlyChoices} choix seulement` : null,
    categories.length ? `${categories.length} catégorie(s)` : null,
  ].filter(Boolean);
  lines.push(
    `  ${(prov.businessName ?? '?').padEnd(24)} ${String(items.length).padStart(3)} à traiter` +
      `   ${parts.join(' · ')}`,
  );
}

const total = todo.reduce((n, p) => n + p.services.length, 0);
const totalCats = todo.reduce((n, p) => n + p.categories.length, 0);
const choiceChars = (s) =>
  (s.choices?.items ?? []).reduce(
    (m, t) => m + t.name.length + t.description.length + (t.values ?? []).join('').length,
    0,
  );
const chars = todo.reduce(
  (n, p) =>
    n +
    p.services.reduce(
      (m, s) =>
        m +
        (s.status === 'choices-only' ? 0 : s.current.name.length + s.current.description.length) +
        choiceChars(s),
      0,
    ) +
    p.categories.reduce((m, c) => m + c.current.name.length, 0),
  0,
);

console.log(
  `\n${scanned} prestations examinées · ${upToDate} à jour · ${total} à traiter` +
    `${choicesOnly ? ` (dont ${choicesOnly} pour les choix seulement)` : ''}` +
    `\n${categoriesScanned} catégories examinées · ${categoriesUpToDate} à jour · ${totalCats} à traiter\n`,
);
if (lines.length) console.log(lines.join('\n'));
else console.log('  Rien à faire : tout est à jour.');

if (total > 0 || totalCats > 0) {
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        locales: LOCALES,
        // Rappel de la marche à suivre, dans le fichier lui-même : il se
        // relit des semaines plus tard, hors du contexte qui l'a produit.
        howTo: [
          'Pour chaque prestation : renseigner "sourceLocale" (la langue dans laquelle',
          'le professionnel a écrit, telle qu\'elle est — pas celle attendue), puis',
          'ajouter un bloc "translations" contenant les AUTRES langues de "locales".',
          'Ne pas fournir d\'entrée pour la langue source : elle ne serait jamais lue.',
          'Ne jamais modifier "current" ni "hash" : ils identifient le texte traduit.',
          'CHOIX : quand "choices" est présent, ajouter "choicesTranslations" = { <langue>: { variations: { <id>: { name, description?, options: { <id>: { name, description? } } } }, options: { <id>: { name, description? } }, infoFields: { <id>: { name, description?, values?: [...] } } } }',
          '— une entrée par id de "choices.items" (les valeurs de variation sous "variations.<groupe>.options.<id>"), les "values" de liste dans le MÊME ORDRE que l\'original.',
          'CATÉGORIES : pour chaque entrée de "categories", renseigner "sourceLocale" et "translations" = { <langue>: { name } }.',
        ].join(' '),
        providers: todo,
      },
      null,
      2,
    ),
  );
  console.log(
    `\n${chars.toLocaleString('fr-FR')} caractères source · ` +
      `${(chars * (LOCALES.length - 1)).toLocaleString('fr-FR')} à produire`,
  );
  console.log(`\nÉcrit dans ${outPath}`);
  console.log('Étape suivante : traduire ce fichier, puis');
  console.log('  SA_PATH=… node scripts/i18n-apply.mjs <fichier-traduit.json>');
}

process.exit(0);
