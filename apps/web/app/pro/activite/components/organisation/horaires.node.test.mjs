/**
 * Résumé d'horaires de la vue Organisation.
 * node --experimental-strip-types --test apps/web/app/pro/activite/components/organisation/horaires.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resumerHoraires, horairesEnVigueur } from './horaires.ts';

const jour = (dayOfWeek, start = '09:00', end = '18:00', extra = {}) => ({
  memberId: 'm1', dayOfWeek, isOpen: true, slots: [{ start, end }], effectiveFrom: null, ...extra,
});

describe('resumerHoraires', () => {
  it('cinq jours contigus deviennent une plage', () => {
    const h = [1, 2, 3, 4, 5].map((j) => jour(j));
    assert.equal(resumerHoraires(h, 'm1'), 'Lun–Ven · 9h–18h');
  });

  it('deux jours isolés sont énumérés, pas transformés en plage', () => {
    assert.equal(resumerHoraires([jour(1), jour(6)], 'm1'), 'Lun, Sam · 9h–18h');
  });

  it('le dimanche ferme la semaine, il n’ouvre pas', () => {
    const h = [5, 6, 0].map((j) => jour(j));
    assert.equal(resumerHoraires(h, 'm1'), 'Ven–Dim · 9h–18h');
  });

  it('des amplitudes différentes ne sont pas résumées par une fausse heure', () => {
    assert.equal(resumerHoraires([jour(1), jour(2, '10:00', '19:00')], 'm1'), 'Lun, Mar · horaires variables');
  });

  it('les minutes sont gardées quand il y en a', () => {
    assert.equal(resumerHoraires([jour(1, '09:30', '17:45')], 'm1'), 'Lun · 9h30–17h45');
  });

  it('la dernière plage du jour donne l’heure de fin', () => {
    const coupure = { ...jour(1), slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] };
    assert.equal(resumerHoraires([coupure], 'm1'), 'Lun · 9h–18h');
  });

  it('un jour ouvert SANS plage ne compte pas', () => {
    assert.equal(resumerHoraires([{ ...jour(1), slots: [] }], 'm1'), null);
  });

  it('aucun horaire enregistré → null, jamais une plage par défaut', () => {
    assert.equal(resumerHoraires([], 'm1'), null);
  });

  it('les horaires d’un autre membre ne fuient pas', () => {
    assert.equal(resumerHoraires([{ ...jour(1), memberId: 'm2' }], 'm1'), null);
  });
});

describe('horairesEnVigueur', () => {
  const maintenant = new Date('2026-09-19T12:00:00Z');

  it('un changement programmé pour plus tard est ignoré', () => {
    const futur = jour(1, '10:00', '20:00', { effectiveFrom: new Date('2026-10-01T00:00:00Z') });
    assert.deepEqual(horairesEnVigueur([futur], maintenant), []);
  });

  it('entre deux versions passées, la plus récente gagne', () => {
    const ancien = jour(1, '09:00', '18:00', { effectiveFrom: new Date('2026-01-01T00:00:00Z') });
    const recent = jour(1, '10:00', '19:00', { effectiveFrom: new Date('2026-09-01T00:00:00Z') });
    const gardes = horairesEnVigueur([ancien, recent], maintenant);
    assert.equal(gardes.length, 1);
    assert.equal(gardes[0].slots[0].start, '10:00');
  });

  it('un horaire sans date d’effet reste en vigueur', () => {
    assert.equal(horairesEnVigueur([jour(1)], maintenant).length, 1);
  });

  it('deux membres gardent chacun leur jour', () => {
    const a = jour(1);
    const b = { ...jour(1), memberId: 'm2' };
    assert.equal(horairesEnVigueur([a, b], maintenant).length, 2);
  });
});
