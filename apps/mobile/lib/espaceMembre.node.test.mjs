/**
 * Espace membre (app) — ce qu'un membre peut ouvrir, et les garde-fous des
 * écrans pro réutilisés : figés sur LUI, sans abonnement ni RevenueCat.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ECRANS_MEMBRE, ecranDuChemin, estOuvertAuMembre } from './espaceMembre.ts';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const lire = (chemin) => readFileSync(resolve(racine, chemin), 'utf8');

describe('les écrans ouverts à un membre', () => {
  it('son agenda, ses rendez-vous, ses horaires, ses blocages, son profil', () => {
    for (const ok of [
      ['(pro)', '(tabs)', 'calendar'], ['(pro)', '(tabs)', 'bookings'], ['(pro)', '(tabs)', 'more'],
      ['(pro)', 'booking-detail', '[id]'], ['(pro)', 'create-booking'], ['(pro)', 'block-slot'],
      ['(pro)', 'availability'], ['(pro)', 'membre-profil'], ['(pro)', 'mes-clientes'],
    ]) assert.equal(estOuvertAuMembre(ok), true, ok.join('/'));
  });
  it('JAMAIS : tableau de bord, abonnement, paiements, prestations, équipe, lieux, réglages, stats, messagerie', () => {
    for (const non of [
      ['(pro)', '(tabs)', 'index'], ['(pro)', 'paywall'], ['(pro)', 'payments'], ['(pro)', 'services'],
      ['(pro)', 'members'], ['(pro)', 'locations'], ['(pro)', 'booking-settings'], ['(pro)', 'stats'],
      ['(pro)', 'profile'], ['(pro)', 'loyalty'], ['(pro)', 'reviews'], ['(pro)', 'support'],
      ['(pro)', 'clients'], ['(pro)', 'client-detail', '[id]'], ['(pro)', 'notification-settings'], ['(pro)'],
    ]) assert.equal(estOuvertAuMembre(non), false, non.join('/'));
  });
  it('le chemin se lit après (pro) et (tabs)', () => {
    assert.equal(ecranDuChemin(['(pro)', '(tabs)', 'calendar']), 'calendar');
    assert.equal(ecranDuChemin(['(pro)', 'booking-detail', '[id]']), 'booking-detail');
    assert.equal(ecranDuChemin(['(pro)']), null);
  });
  it('chaque écran autorisé existe vraiment', () => {
    for (const e of ECRANS_MEMBRE) {
      const chemins = [`apps/mobile/app/(pro)/(tabs)/${e}.tsx`, `apps/mobile/app/(pro)/${e}.tsx`, `apps/mobile/app/(pro)/${e}/[id].tsx`];
      assert.ok(chemins.some((c) => { try { lire(c); return true; } catch { return false; } }), e);
    }
  });
});

describe('les écrans pro réutilisés sont figés sur le membre', () => {
  it('agenda : filtre imposé, pas de sélecteur, pas de flux d’agenda du salon', () => {
    const src = lire('apps/mobile/app/(pro)/(tabs)/calendar.tsx');
    assert.match(src, /useState<string \| null>\(monMemberId \?\? memberIdParam \?\? null\)/);
    assert.match(src, /const showMemberFilter = !estMembre && members\.length > 1;/);
    assert.match(src, /\{!estMembre && \(\s*<Pressable\s*onPress=\{\(\) => setSyncOpen\(true\)\}/);
  });
  it('réservations, création, blocages, activités, horaires : restreints à LUI', () => {
    assert.match(lire('apps/mobile/app/(pro)/(tabs)/bookings.tsx'), /const memberFilter = monMemberId \?\? filtreChoisi;/);
    assert.match(lire('apps/mobile/app/(pro)/create-booking.tsx'), /const moi = membersData\.filter\(\(m\) => m\.id === monMemberId\);/);
    assert.match(lire('apps/mobile/app/(pro)/block-slot.tsx'), /m\.isActive && \(!monMemberId \|\| m\.id === monMemberId\)/);
    assert.match(lire('apps/mobile/app/(pro)/create-activity.tsx'), /m\.isActive && \(!monMemberId \|\| m\.id === monMemberId\)/);
    assert.match(lire('apps/mobile/app/(pro)/availability.tsx'), /const visibles = monMemberId \? list\.filter\(\(m\) => m\.id === monMemberId\) : list;/);
    assert.match(lire('apps/mobile/app/(pro)/blocked-slots.tsx'), /monMemberId \? tousLesBlocages\.filter\(\(s\) => s\.memberId === monMemberId\)/);
  });
  it('jamais d’identification RevenueCat avec le salon pour un membre', () => {
    assert.match(lire('apps/mobile/contexts/RevenueCatContext.tsx'), /const providerId = estMembre \? null : idDuSalon;/);
  });
  it('l’aiguillage attend le compte membre avant de choisir un côté', () => {
    const src = lire('apps/mobile/app/index.tsx');
    assert.match(src, /compteMembre === undefined/);
    assert.match(src, /if \(compteMembre\) \{\s*return <Redirect href=\{'\/\(pro\)\/\(tabs\)\/calendar' as never\} \/>;/);
  });
});

describe('les textes du mode membre existent dans les cinq langues', () => {
  it('chaque clé utilisée, pluriels et clés dynamiques compris', () => {
    const fichiers = [
      'apps/mobile/app/(pro)/(tabs)/more.tsx', 'apps/mobile/app/(pro)/membre-profil.tsx', 'apps/mobile/app/(pro)/mes-clientes.tsx',
      'apps/mobile/app/(pro)/mon-activite.tsx', 'apps/mobile/app/(pro)/members.tsx',
      'apps/mobile/components/business/GardeEspaceMembre.tsx', 'apps/mobile/components/business/AccesAppMembres.tsx',
    ];
    const cles = new Set();
    for (const f of fichiers) for (const m of lire(f).matchAll(/espaceMembre\.([A-Za-z]+\.[A-Za-z]+)(?=['`])/g)) cles.add(m[1]);
    for (const p of ['mois', 'moisDernier', 'annee']) cles.add(`activite.${p}`);
    for (const st of ['pending_payment', 'pending', 'confirmed', 'cancelled', 'noshow']) cles.add(`clientes.statut.${st}`);
    assert.ok(cles.size > 40, `${cles.size} clés`);
    for (const loc of ['fr', 'en', 'it', 'pt', 'de']) {
      const d = JSON.parse(lire(`apps/mobile/locales/app/${loc}.json`)).espaceMembre;
      for (const k of cles) {
        const chemin = k.split('.');
        let v = d;
        for (const c of chemin.slice(0, -1)) v = v?.[c];
        const fin = chemin.at(-1);
        const ok = v && (v[fin] !== undefined || (v[`${fin}_one`] !== undefined && v[`${fin}_other`] !== undefined));
        assert.ok(ok, `${loc}: espaceMembre.${k}`);
      }
    }
  });
});
