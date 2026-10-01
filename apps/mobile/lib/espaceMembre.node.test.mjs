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
  it('son accueil, son agenda, ses rendez-vous, ses horaires, ses blocages, son profil', () => {
    for (const ok of [
      ['(pro)', '(tabs)'], ['(pro)', '(tabs)', 'index'],
      ['(pro)', '(tabs)', 'calendar'], ['(pro)', '(tabs)', 'bookings'], ['(pro)', '(tabs)', 'more'],
      ['(pro)', 'booking-detail', '[id]'], ['(pro)', 'create-booking'], ['(pro)', 'block-slot'],
      ['(pro)', 'availability'], ['(pro)', 'planning-horaires'], ['(pro)', 'membre-profil'], ['(pro)', 'mes-clientes'],
    ]) assert.equal(estOuvertAuMembre(ok), true, ok.join('/'));
  });
  it('JAMAIS : tableau de bord, abonnement, paiements, prestations, équipe, lieux, réglages, stats, messagerie', () => {
    for (const non of [
      ['(pro)', 'paywall'], ['(pro)', 'payments'], ['(pro)', 'services'],
      ['(pro)', 'members'], ['(pro)', 'locations'], ['(pro)', 'booking-settings'], ['(pro)', 'stats'],
      ['(pro)', 'profile'], ['(pro)', 'loyalty'], ['(pro)', 'reviews'], ['(pro)', 'support'],
      ['(pro)', 'clients'], ['(pro)', 'client-detail', '[id]'], ['(pro)', 'notification-settings'], ['(pro)'],
    ]) assert.equal(estOuvertAuMembre(non), false, non.join('/'));
  });
  it('le chemin se lit après (pro) et (tabs)', () => {
    assert.equal(ecranDuChemin(['(pro)', '(tabs)', 'calendar']), 'calendar');
    assert.equal(ecranDuChemin(['(pro)', 'booking-detail', '[id]']), 'booking-detail');
    assert.equal(ecranDuChemin(['(pro)', '(tabs)']), 'index', 'onglet d’accueil');
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
    // Synchro d'agenda : ouverte au membre, mais avec SON flux — le serveur
    // range son jeton sur memberAccounts et ne sert que ses rendez-vous.
    assert.match(src, /onPress=\{\(\) => setSyncOpen\(true\)\}/);
    const gestion = lire('apps/web/app/api/pro/calendar-feed/route.ts');
    assert.match(gestion, /collection\('memberAccounts'\)\.doc\(uid\)/);
    const flux = lire('apps/web/app/api/calendar/feed/[token]/route.ts');
    assert.match(flux, /if \(membre && b\.memberId !== membre\.memberId\) continue;/);
    assert.match(flux, /compte\.data\(\)\.active !== true/);
  });
  it('réservations, création, blocages, activités, horaires : restreints à LUI', () => {
    assert.match(lire('apps/mobile/app/(pro)/(tabs)/bookings.tsx'), /const memberFilter = monMemberId \?\? filtreChoisi;/);
    assert.match(lire('apps/mobile/app/(pro)/create-booking.tsx'), /const moi = membersData\.filter\(\(m\) => m\.id === monMemberId\);/);
    assert.match(lire('apps/mobile/app/(pro)/block-slot.tsx'), /m\.isActive && \(!monMemberId \|\| m\.id === monMemberId\)/);
    assert.match(lire('apps/mobile/app/(pro)/create-activity.tsx'), /m\.isActive && \(!monMemberId \|\| m\.id === monMemberId\)/);
    assert.match(lire('apps/mobile/app/(pro)/availability.tsx'), /const visibles = monMemberId \? list\.filter\(\(m\) => m\.id === monMemberId\) : list;/);
    assert.match(lire('apps/mobile/app/(pro)/planning-horaires.tsx'), /const visibles = monMemberId \? liste\.filter\(\(m\) => m\.id === monMemberId\) : liste;/);
    assert.match(lire('apps/mobile/app/(pro)/blocked-slots.tsx'), /monMemberId \? tousLesBlocages\.filter\(\(s\) => s\.memberId === monMemberId\)/);
  });
  it('jamais d’identification RevenueCat avec le salon pour un membre', () => {
    assert.match(lire('apps/mobile/contexts/RevenueCatContext.tsx'), /const providerId = estMembre \? null : idDuSalon;/);
  });
  it('après la connexion aussi : la garde de l’écran de connexion et la page introuvable', () => {
    const auth = lire('apps/mobile/app/(auth)/_layout.tsx');
    assert.match(auth, /compteMembre !== undefined/);
    assert.match(auth, /if \(!isProvider && compteMembre\) \{\s*return <Redirect href=\{'\/\(pro\)\/\(tabs\)' as never\} \/>;/);
    const introuvable = lire('apps/mobile/app/+not-found.tsx');
    assert.match(introuvable, /\} else if \(compteMembre\) \{/);
  });
  it('l’aiguillage attend le compte membre avant de choisir un côté', () => {
    const src = lire('apps/mobile/app/index.tsx');
    assert.match(src, /compteMembre === undefined/);
    assert.match(src, /if \(compteMembre\) \{\s*return <Redirect href=\{'\/\(pro\)\/\(tabs\)' as never\} \/>;/);
  });
});

describe('les textes du mode membre existent dans les cinq langues', () => {
  it('chaque clé utilisée, pluriels et clés dynamiques compris', () => {
    const fichiers = [
      'apps/mobile/app/(pro)/(tabs)/more.tsx', 'apps/mobile/app/(pro)/membre-profil.tsx', 'apps/mobile/app/(pro)/mes-clientes.tsx',
      'apps/mobile/app/(pro)/mon-activite.tsx', 'apps/mobile/app/(pro)/members.tsx',
      'apps/mobile/components/business/GardeEspaceMembre.tsx', 'apps/mobile/components/business/AccesAppMembres.tsx',
      'apps/mobile/app/(auth)/index.tsx', 'apps/mobile/app/(auth)/login.tsx', 'apps/mobile/app/(auth)/pro.tsx',
      'apps/mobile/components/business/AccueilMembre.tsx',
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

describe('livré éteint : l’interrupteur config/espaceMembre', () => {
  it('le serveur refuse d’inviter pour un salon non ouvert', () => {
    const src = lire('apps/web/lib/espace-membre.ts');
    assert.match(src, /if \(!espaceMembreOuvert\(config\.data\(\), providerId\)\) return \{ ok: false, raison: 'pas-ouvert' \};/);
  });
  it('l’interface du gérant n’apparaît que si l’interrupteur est ouvert — site et app', () => {
    assert.match(lire('apps/web/app/pro/activite/components/MemberModal.tsx'), /\.\.\.\(espaceMembreOuvert \? \[\{ id: 'app'/);
    assert.match(lire('apps/web/app/pro/activite/components/EquipeTab.tsx'), /espaceMembreOuvert && <ReglagesEspaceMembre/);
    const app = lire('apps/mobile/app/(pro)/members.tsx');
    assert.match(app, /!member\.isDefault && espaceMembreOuvert && \(\(\) => \{/);
    assert.match(app, /providerId && espaceMembreOuvert && members\.some/);
  });
});
