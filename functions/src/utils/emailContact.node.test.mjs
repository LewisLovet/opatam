/**
 * Le numéro du prestataire dans l'e-mail de confirmation : un BOUTON qui
 * appelle, et la ligne « Contact » de la version texte.
 *
 * `telHref` est un module pur : il est testé pour de vrai. Les gabarits, eux,
 * importent firebase-functions et ne se chargent pas hors runtime — ils sont
 * donc contrôlés statiquement.
 *
 * node --experimental-strip-types --test functions/src/utils/emailContact.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { telHref } from '../lib/telephone.ts';

const racine = new URL('../../../', import.meta.url).pathname;
const lire = (p) => readFileSync(racine + p, 'utf8');

describe('1. telHref — ce que le bouton compose vraiment', () => {
  it('garde les chiffres, quels que soient les séparateurs saisis', () => {
    assert.equal(telHref('06 12 34 56 78'), '0612345678');
    assert.equal(telHref('06.12.34.56.78'), '0612345678');
    assert.equal(telHref('06-12-34-56-78'), '0612345678');
    assert.equal(telHref('(0)6 12 34 56 78'), '0612345678');
  });
  it('conserve le « + » international, et seulement en tête', () => {
    assert.equal(telHref('+33 6 12 34 56 78'), '+33612345678');
    assert.equal(telHref('  +41 79 000 00 00 '), '+41790000000');
    assert.equal(telHref('00 33 6 12 34 56 78'), '0033612345678', 'un 00 n’invente pas de +');
    assert.equal(telHref('06 12 +34'), '061234', 'un + au milieu est un séparateur, pas un indicatif');
  });
  it('rend une chaîne vide quand il n’y a rien à composer — pas de bouton', () => {
    for (const rien of [null, undefined, '', '   ', 'à venir', '--']) {
      assert.equal(telHref(rien), '', `« ${rien} » ne compose rien`);
    }
  });
});

describe('2. le bouton dans le gabarit HTML', () => {
  const src = lire('functions/src/utils/resendService.ts');
  const bouton = src.slice(src.indexOf('function boutonAppelHtml('), src.indexOf('/** Address-privacy aware location rows.'));

  it('le numéro est DANS le bouton, et le bouton appelle', () => {
    assert.match(bouton, /href="tel:\$\{escapeHtml\(href\)\}"/, 'lien tel: échappé');
    assert.match(bouton, /\$\{c\.callCta\} \$\{escapeHtml\(phone\)\}/, 'libellé + numéro visibles dans le bouton');
    assert.match(bouton, /display: inline-block/, 'rendu comme un bouton, pas comme une ligne de texte');
    assert.match(bouton, /<table role="presentation"[^>]*><tr><td align="center">/, 'centré en table, comme les autres boutons');
  });
  it('rien à composer, rien à afficher', () => {
    assert.match(bouton, /if \(!phone\) return '';/);
    assert.match(bouton, /if \(!href\) return '';/);
  });
  it('la confirmation appelle le bouton, et n’a plus de ligne « Contact » dans le tableau', () => {
    const html = src.slice(src.indexOf('function generateConfirmationHtml('), src.indexOf('function generateConfirmationText('));
    assert.match(html, /\$\{boutonAppelHtml\(data\.providerPhone, l\)\}/);
    assert.doesNotMatch(html, /c\.labels\.phone/, 'le numéro n’est plus une ligne du tableau des détails');
  });
  it('la version texte garde la ligne « Contact » — un bouton n’existe pas en texte brut', () => {
    const texte = src.slice(src.indexOf('function generateConfirmationText('));
    assert.match(texte, /data\.providerPhone \? `- \$\{c\.labels\.phone\}/);
  });
  it('le champ existe sur les données d’e-mail', () => {
    assert.ok(src.includes('providerPhone?: string | null;'), 'champ absent de BookingEmailData');
  });
});

describe('3. les libellés, dans les cinq langues', () => {
  const i18n = lire('functions/src/utils/emailI18n.ts');
  it('« Appeler » existe partout', () => {
    for (const lib of ["callCta: 'Appeler'", "callCta: 'Call'", "callCta: 'Chiama'", "callCta: 'Ligar'", "callCta: 'Anrufen'"]) {
      assert.ok(i18n.includes(lib), `libellé manquant : ${lib}`);
    }
    assert.equal((i18n.match(/^\s*callCta: '/gm) ?? []).length, 5, 'un libellé par langue');
  });
  it('le libellé « Contact » de la version texte reste, lui aussi, dans les cinq langues', () => {
    assert.equal((i18n.match(/^\s*phone: '/gm) ?? []).length, 5);
  });
});

describe('4. le numéro vient du COMPTE du prestataire', () => {
  it('lecture de users/{userId}.phone — le document providers n’en porte pas', () => {
    const src = lire('functions/src/notifications/bookingEmails.ts');
    assert.ok(src.includes("collection('users').doc(userId).get()"), 'lecture users/{userId}');
    const fn = src.slice(src.indexOf('async function toEmailData('));
    assert.ok(fn.includes('await getProviderPhone(booking.providerId)'));
    assert.ok(fn.includes('providerPhone,'));
  });
});
