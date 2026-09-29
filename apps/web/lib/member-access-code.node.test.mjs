/**
 * Codes d'accès au planning — les surfaces qui ne doivent plus les exposer.
 *
 * Le code vivait dans la fiche publique du membre, et la page de chaque
 * salon recopiait cette fiche ENTIÈRE dans son HTML (code, e-mail et
 * téléphone de chaque membre, lisibles par tout visiteur). Ces tests
 * statiques figent la correction, surface par surface.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const lire = (chemin) => readFileSync(resolve(racine, chemin), 'utf8');

describe('la page publique du salon', () => {
  for (const chemin of ['apps/web/app/p/[slug]/page.tsx', 'apps/web/app/p/[slug]/reserver/page.tsx', 'apps/web/app/p/[slug]/embed/page.tsx']) {
    it(`${chemin} : liste FERMÉE des champs membre envoyés au navigateur`, () => {
      const src = lire(chemin);
      const bloc = src.slice(src.indexOf('const serializedMembers'), src.indexOf('}));', src.indexOf('const serializedMembers')));
      assert.ok(bloc.length > 0, 'sérialisation trouvée');
      assert.doesNotMatch(bloc, /\.\.\.m\b/, 'pas de recopie de la fiche entière');
      for (const champ of ['accessCode', 'email', 'phone']) assert.doesNotMatch(bloc, new RegExp(`\\b${champ}\\b`), champ);
    });
  }
});

describe('les fiches membres ne portent plus le code', () => {
  it('le service ne l’écrit plus à la création ni à la régénération', () => {
    const src = lire('packages/firebase/src/services/member.service.ts');
    const creations = src.slice(src.indexOf('async createMember('), src.indexOf('async getDefaultMember('));
    assert.doesNotMatch(creations, /accessCode,/, 'pas de code dans la fiche créée');
    assert.match(creations, /attribuerCodeSansBloquer\(providerId, memberId/);
    const regen = src.slice(src.indexOf('async regenerateAccessCode('), src.indexOf('async getByProviderAvecCodes('));
    assert.doesNotMatch(regen, /accessCode: newAccessCode/);
    assert.match(regen, /retirerCodesAcces\(providerId, memberId, newAccessCode\)/, 'l’ancien code cesse d’ouvrir le planning');
  });
  it('le schéma de mise à jour ne laisse plus passer de code', () => {
    const src = lire('packages/shared/src/schemas/member.schema.ts');
    assert.doesNotMatch(src, /accessCode: z\./);
  });
  it('plus aucune recherche par code côté client', () => {
    assert.doesNotMatch(lire('packages/firebase/src/repositories/member.repository.ts'), /where\('accessCode'/);
    assert.doesNotMatch(lire('packages/firebase/src/services/member.service.ts'), /getMemberByAccessCode/);
  });
});

describe('le planning se connecte côté serveur', () => {
  for (const route of ['auth', 'bookings', 'booking-data']) {
    it(`/api/planning/${route} passe par membreParCode (Admin SDK)`, () => {
      const src = lire(`apps/web/app/api/planning/${route}/route.ts`);
      assert.match(src, /membreParCode\(/);
      assert.doesNotMatch(src, /memberService/);
    });
  }
  it('le code est validé AVANT de devenir un chemin de document', () => {
    const src = lire('apps/web/lib/member-access-code.ts');
    const fn = src.slice(src.indexOf('export async function membreParCode'));
    assert.ok(fn.indexOf('normaliserCode(brut)') < fn.indexOf(".doc(code)"), 'validation puis lecture');
    assert.match(src, /\/\^\[A-Z0-9-\]\{2,24\}\$\//);
  });
});

describe("l'envoi du code n'est plus un relais d'e-mails ouvert", () => {
  it('/api/send-member-code exige le jeton du gérant et relit tout en base', () => {
    const src = lire('apps/web/app/api/send-member-code/route.ts');
    assert.match(src, /verifyIdToken\(/);
    assert.match(src, /if \(uid !== providerId\)/);
    assert.doesNotMatch(src, /body\.memberEmail|memberEmail, accessCode, businessName \} = body/, 'plus rien du corps dans l’e-mail');
    assert.match(src, /echapper\(memberSnap\.get\('name'\)\)/);
  });
  it('l’onglet Équipe envoie le jeton et seulement l’identité du membre', () => {
    const src = lire('apps/web/app/pro/activite/components/EquipeTab.tsx');
    const envoi = src.slice(src.indexOf('const handleSendCode'), src.indexOf("if (loading)"));
    assert.match(envoi, /Authorization: `Bearer \$\{token\}`/);
    assert.match(envoi, /JSON\.stringify\(\{ providerId: provider\.id, memberId: member\.id \}\)/);
  });
});

describe('les e-mails du planning lisent le code à part', () => {
  for (const chemin of ['functions/src/scheduled/sendDailyAgendaSummary.ts', 'functions/src/callable/testDailyAgendaSummary.ts']) {
    it(chemin, () => {
      const src = lire(chemin);
      assert.match(src, /codesDuSalon\(db, providerId/);
      assert.doesNotMatch(src, /member\.accessCode/);
    });
  }
  it('/api/pro/send-agenda-summary aussi', () => {
    const src = lire('apps/web/app/api/pro/send-agenda-summary/route.ts');
    assert.match(src, /codeDuMembre\(providerId, memberId\)/);
    assert.doesNotMatch(src, /member\.accessCode/);
  });
});
