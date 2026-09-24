/**
 * Journal des e-mails — ce qu'on écrit en base pour chaque envoi.
 *
 *   npx tsx --test --test-timeout=20000 functions/test/emailJournal.tsx.test.ts
 *
 * En `tsx` et non vitest : le lanceur vitest du dépôt est cassé.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { construireEntreeJournal, metaDepuis } from '../src/lib/emailJournal';

const charge = {
  from: 'Opatam <noreply@kamerleontech.com>',
  to: 'camille.e.m97@gmail.com',
  subject: 'Votre rendez-vous est confirmé',
  html: '<p>…</p>',
};

describe('metaDepuis — ce que l’e-mail annonçait, sans relire l’e-mail', () => {
  it('extrait l’identifiant de réservation et l’heure AFFICHÉE dans le fuseau du salon', () => {
    // Le cas de ce matin : deux réservations d'une même cliente, et la
    // question « qu'est-ce que l'e-mail lui a dit ? » demandait de fouiller
    // les logs à la minute près.
    const meta = metaDepuis('confirmation', {
      bookingId: 'ASSZZ1hMexMzywtIN8kl',
      providerId: 'atSpMIK28nga2pWmZIKSZB3Z92G3',
      clientEmail: 'camille.e.m97@gmail.com',
      serviceName: 'Dépose + Manucure Russe',
      datetime: new Date('2026-09-26T11:30:00Z'),
      duration: 120,
      locale: 'fr',
    });
    assert.equal(meta.type, 'confirmation');
    assert.equal(meta.bookingId, 'ASSZZ1hMexMzywtIN8kl');
    assert.equal(meta.providerId, 'atSpMIK28nga2pWmZIKSZB3Z92G3');
    assert.equal(meta.locale, 'fr');
    assert.equal(meta.resume?.datetime, '2026-09-26T11:30:00.000Z');
    assert.match(String(meta.resume?.affiche), /samedi 26 septembre à 13:30/);
    assert.equal(meta.resume?.timeZone, 'Europe/Paris');
    assert.equal(meta.resume?.duration, 120);
  });

  it('respecte le fuseau du salon quand la charge le porte', () => {
    const meta = metaDepuis('confirmation', {
      datetime: new Date('2026-09-25T04:00:00Z'),
      timeZone: 'Indian/Reunion',
    });
    assert.match(String(meta.resume?.affiche), /vendredi 25 septembre à 08:00/);
    assert.equal(meta.resume?.timeZone, 'Indian/Reunion');
  });

  it('une charge sans rendez-vous (mot de passe, bienvenue) n’invente rien', () => {
    const meta = metaDepuis('password_reset', { email: 'x@y.z' });
    assert.equal(meta.bookingId, null);
    assert.equal(meta.resume, null);
  });

  it('un complément explicite prime sur la charge', () => {
    const meta = metaDepuis('daily_agenda_provider', {}, { providerId: 'p1', resume: { demain: '2026-09-25' } });
    assert.equal(meta.providerId, 'p1');
    assert.deepEqual(meta.resume, { demain: '2026-09-25' });
  });
});

describe('construireEntreeJournal — le document écrit', () => {
  it('un envoi réussi : statut sent, identifiant Resend, destinataires en tableau', () => {
    const doc = construireEntreeJournal(charge, metaDepuis('confirmation', { bookingId: 'b1' }), {
      error: null,
      id: 'resend-123',
    });
    assert.equal(doc.status, 'sent');
    assert.equal(doc.resendId, 'resend-123');
    assert.equal(doc.error, null);
    assert.deepEqual(doc.to, ['camille.e.m97@gmail.com']);
    assert.equal(doc.bookingId, 'b1');
    assert.equal(doc.subject, 'Votre rendez-vous est confirmé');
    assert.ok(doc.sentAt, 'horodatage serveur présent');
  });

  it('un envoi en échec : statut failed, l’erreur conservée, pas d’identifiant', () => {
    const doc = construireEntreeJournal(charge, metaDepuis('reminder', {}), {
      error: { message: 'Invalid `to` address' },
      id: null,
    });
    assert.equal(doc.status, 'failed');
    assert.equal(doc.resendId, null);
    assert.equal(doc.error, 'Invalid `to` address');
  });

  it('plusieurs destinataires restent une liste', () => {
    const doc = construireEntreeJournal({ ...charge, to: ['a@x.z', 'b@x.z'] }, metaDepuis('support_message', {}), {
      error: null,
      id: 'r',
    });
    assert.deepEqual(doc.to, ['a@x.z', 'b@x.z']);
  });
});
