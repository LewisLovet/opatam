/**
 * Fuseau horaire des LIEUX — rapport, puis application.
 *
 * ⚠ LE PIÈGE DE CE SCRIPT, à ne pas réintroduire : sa première version
 * écrivait « Europe/Paris » sur un lieu français SANS coordonnées. M.A
 * Barber est exactement ce cas — un salon réunionnais — et la migration
 * aurait gravé dans la base le bug qu'elle était censée corriger. Le
 * résolveur refuse désormais de trancher la France, l'Espagne et le
 * Portugal sans coordonnées ni code postal ; ces lieux ressortent en
 * « MANUEL REQUIS ». Ne jamais leur donner de valeur par défaut.
 *
 * Étape 8 du chantier fuseaux. Par défaut, ce script N'ÉCRIT RIEN : il
 * affiche ce qu'il poserait sur chaque lieu et pourquoi. C'est le point
 * important — on regarde le rapport AVANT de toucher quoi que ce soit,
 * parce qu'un fuseau faux ne se voit pas : il décale les rendez-vous d'une
 * heure et personne ne s'en aperçoit avant la première cliente fâchée.
 *
 * Usage :
 *   SA_PATH="$PWD/service-account.json" node scripts/fuseaux-lieux.mjs           # rapport seul
 *   SA_PATH="$PWD/service-account.json" node scripts/fuseaux-lieux.mjs --apply   # écrit
 *   … --provider <id>    limite à un prestataire (pour un essai ciblé)
 *
 * CE QU'IL NE FAIT PAS :
 *  - il ne touche JAMAIS un fuseau posé à la main (`timezoneSource: manual`) :
 *    une correction manuelle existe parce que l'automatique s'était trompé ;
 *  - il ne touche AUCUNE réservation. Les rendez-vous existants ne peuvent
 *    pas être migrés automatiquement : on ne sait pas dans quel fuseau ils
 *    ont été calculés (`createdVia` n'existe que depuis ce chantier).
 *    Ils se valident à la main, salon par salon.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resoudreFuseauDeLieu, aBesoinDeResolution } from '../packages/shared/src/utils/fuseau-lieu.ts';

const apply = process.argv.includes('--apply');
const iProvider = process.argv.indexOf('--provider');
const providerFiltre = iProvider >= 0 ? process.argv[iProvider + 1] : null;

const sa = JSON.parse(readFileSync(process.env.SA_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: 'opatam-da04b' });
const db = getFirestore();

const providers = providerFiltre
  ? [await db.collection('providers').doc(providerFiltre).get()]
  : (await db.collection('providers').get()).docs;

const lignes = [];
const aEcrire = [];

for (const p of providers) {
  if (!p.exists) continue;
  const lieux = await db.collection('providers').doc(p.id).collection('locations').get();
  for (const l of lieux.docs) {
    const lieu = l.data();
    const geo = lieu.geopoint
      ? { latitude: lieu.geopoint.latitude ?? lieu.geopoint._latitude, longitude: lieu.geopoint.longitude ?? lieu.geopoint._longitude }
      : null;
    const r = resoudreFuseauDeLieu(geo, lieu.countryCode, lieu.postalCode);
    const besoin = aBesoinDeResolution(lieu);

    lignes.push({
      provider: p.data().businessName ?? p.id,
      lieu: lieu.name ?? l.id,
      pays: lieu.countryCode ?? '—',
      coordonnees: geo ? `${geo.latitude.toFixed(3)},${geo.longitude.toFixed(3)}` : 'ABSENTES',
      cp: lieu.postalCode ?? '—',
      actuel: lieu.timezone ?? '—',
      source: lieu.timezoneSource ?? '—',
      propose: r.fuseau ?? '??? À TRANCHER',
      motif: `${r.motif} · ${r.libelle}`,
      action: !besoin ? 'inchangé' : r.fuseau ? 'à poser' : 'MANUEL REQUIS',
    });

    if (besoin && r.fuseau) {
      aEcrire.push({ ref: l.ref, fuseau: r.fuseau });
    }
  }
}

// ── Rapport ───────────────────────────────────────────────────────────────
console.log(`\n${lignes.length} lieu(x) examiné(s)\n`);
for (const l of lignes) {
  const marque = l.action === 'MANUEL REQUIS' ? '  ⚠' : l.action === 'à poser' ? '  +' : '   ';
  console.log(
    `${marque} ${l.provider} / ${l.lieu}\n` +
      `     pays ${l.pays} · CP ${l.cp} · coordonnées ${l.coordonnees}\n` +
      `     actuel ${l.actuel} (${l.source}) → ${l.propose}   [${l.motif}] ${l.action}`,
  );
}

const parAction = lignes.reduce((acc, l) => ({ ...acc, [l.action]: (acc[l.action] ?? 0) + 1 }), {});
console.log('\nRésumé :', parAction);

const horsParis = lignes.filter((l) => l.propose !== 'Europe/Paris' && l.propose !== '??? À TRANCHER');
if (horsParis.length) {
  console.log(`\n${horsParis.length} lieu(x) NE SONT PAS à l’heure de Paris — ce sont eux qui étaient faux :`);
  for (const l of horsParis) console.log(`   · ${l.provider} / ${l.lieu} → ${l.propose}`);
}

const aTrancher = lignes.filter((l) => l.action === 'MANUEL REQUIS');
if (aTrancher.length) {
  console.log(
    `\n${aTrancher.length} lieu(x) que le script REFUSE de deviner (pays non servi, ` +
      `ou coordonnées absentes) — à renseigner à la main dans la fiche du lieu.`,
  );
}

// ── Application ───────────────────────────────────────────────────────────
if (!apply) {
  console.log(`\n(simulation — rien n’a été écrit. Relancer avec --apply pour poser ${aEcrire.length} fuseau(x).)\n`);
  process.exit(0);
}

let ecrits = 0;
for (const { ref, fuseau } of aEcrire) {
  await ref.update({
    timezone: fuseau,
    timezoneSource: 'automatic',
    timezoneResolvedAt: Timestamp.now(),
  });
  ecrits++;
}
console.log(`\n${ecrits} fuseau(x) posé(s).\n`);
