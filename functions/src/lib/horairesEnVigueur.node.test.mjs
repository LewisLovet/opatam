/**
 * Le miroir des functions (`horairesEnVigueur.ts`) rend EXACTEMENT ce que
 * rend la règle partagée (`@booking-app/shared/utils/horaires`) : la
 * prochaine disponibilité affichée et les créneaux réservables ne doivent
 * jamais diverger. Comparaison sur des milliers de cas tirés au hasard.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { horaireEnVigueurLe as miroir } from './horairesEnVigueur.ts';
import { horaireEnVigueurLe as partage } from '../../../packages/shared/src/utils/horaires.ts';

describe('horaires en vigueur — miroir des functions = règle partagée', () => {
  it('10 000 cas aléatoires : même document retenu', () => {
    let graine = 7;
    const alea = () => (graine = (graine * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const jourN = (n) => new Date(Date.UTC(2026, 9, 1 + n)).toISOString().slice(0, 10);
    const effet = (d) => d.toISOString().slice(0, 10);
    for (let cas = 0; cas < 10_000; cas++) {
      const docs = Array.from({ length: 1 + Math.floor(alea() * 6) }, (_, i) => ({
        id: `d${i}`,
        dayOfWeek: Math.floor(alea() * 7),
        effectiveFrom: alea() < 0.4 ? null : new Date(Date.UTC(2026, 9, 1 + Math.floor(alea() * 90))),
      }));
      const js = Math.floor(alea() * 7);
      const jour = jourN(Math.floor(alea() * 120));
      assert.equal(miroir(docs, js, jour, effet)?.id, partage(docs, js, jour, effet)?.id, `cas ${cas}`);
    }
  });
});
