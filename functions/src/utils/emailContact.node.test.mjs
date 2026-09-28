/**
 * Ligne « Contact » des e-mails de confirmation : le numéro du prestataire.
 * Contrôle statique — les gabarits importent firebase-functions et ne se
 * chargent pas hors runtime.
 *
 * node --experimental-strip-types --test functions/src/utils/emailContact.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const racine = new URL('../../../', import.meta.url).pathname;
const lire = (p) => readFileSync(racine + p, 'utf8');

describe('téléphone du prestataire dans la confirmation', () => {
  it('le libellé existe dans les cinq langues', () => {
    const i18n = lire('functions/src/utils/emailI18n.ts');
    for (const lib of ["phone: 'Contact'", "phone: 'Contatto'", "phone: 'Contacto'", "phone: 'Kontakt'"]) {
      assert.ok(i18n.includes(lib), `libellé manquant : ${lib}`);
    }
    assert.equal((i18n.match(/^\s*phone: '/gm) ?? []).length, 5, 'un libellé par langue');
  });
  it('le gabarit HTML et le texte rendent providerPhone, avec un lien tel:', () => {
    const src = lire('functions/src/utils/resendService.ts');
    const html = src.slice(src.indexOf('function generateConfirmationHtml('), src.indexOf('function generateConfirmationText('));
    const texte = src.slice(src.indexOf('function generateConfirmationText('));
    assert.match(html, /data\.providerPhone \? `<tr>.*c\.labels\.phone.*href="tel:/s);
    assert.match(texte, /data\.providerPhone \? `- \$\{c\.labels\.phone\}/);
    assert.ok(src.includes('providerPhone?: string | null;'), 'champ absent de BookingEmailData');
  });
  it('les données d’e-mail lisent le numéro sur le COMPTE du prestataire', () => {
    const src = lire('functions/src/notifications/bookingEmails.ts');
    assert.ok(src.includes("collection('users').doc(userId).get()"), 'lecture users/{userId}');
    const fn = src.slice(src.indexOf('async function toEmailData('));
    assert.ok(fn.includes('await getProviderPhone(booking.providerId)'));
    assert.ok(fn.includes('providerPhone,'));
  });
});
