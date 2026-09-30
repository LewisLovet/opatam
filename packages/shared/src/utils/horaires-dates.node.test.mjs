/**
 * Horaires d'un membre jour par jour — les priorités entre semaine type,
 * option « horaires variables » et horaires datés, la validation d'un
 * réglage, et la copie de semaine.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// `horaires-dates.ts` importe `./horaires` sans extension (forme Next/Metro).
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); }
    catch (e) {
      if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) return next(specifier + '.ts', context);
      throw e;
    }
  }
`));
const { horairesDuJour, reglageDateDuJour, raisonHorairesDatesInvalides, copierSemaine } = await import('./horaires-dates.ts');
const { ajouterJours, jourSemaineCalendaire } = await import('./fuseaux.ts');

const effet = (d) => d.toISOString().slice(0, 10);
// Semaine type : lun–ven 9h–18h, week-end fermé.
const SEMAINE = [0, 1, 2, 3, 4, 5, 6].map((j) => ({
  dayOfWeek: j,
  isOpen: j >= 1 && j <= 5,
  slots: j >= 1 && j <= 5 ? [{ start: '09:00', end: '18:00' }] : [],
  effectiveFrom: null,
}));
const jourDe = (jour, dates = [], horairesVariables = false, semaine = SEMAINE) =>
  horairesDuJour({ jour, jourSemaine: jourSemaineCalendaire(jour), semaine, dates, horairesVariables, jourDEffet: effet });
const T = (n) => new Date(Date.UTC(2026, 9, 1, 0, 0, n)); // instants de création croissants

describe('sans horaires datés : exactement la semaine type', () => {
  it('lundi ouvert 9h–18h, dimanche fermé', () => {
    assert.deepEqual(jourDe('2026-10-05'), { ouvert: true, plages: [{ start: '09:00', end: '18:00' }], source: 'semaine' });
    assert.deepEqual(jourDe('2026-10-04'), { ouvert: false, plages: [], source: 'semaine' });
  });
  it('un changement programmé ne compte qu’à partir de sa date', () => {
    const semaine = [...SEMAINE, { dayOfWeek: 1, isOpen: true, slots: [{ start: '14:00', end: '20:00' }], effectiveFrom: new Date('2026-10-12T00:00:00Z') }];
    assert.equal(jourDe('2026-10-05', [], false, semaine).plages[0].start, '09:00');
    assert.equal(jourDe('2026-10-12', [], false, semaine).plages[0].start, '14:00');
  });
});

describe('horaires datés', () => {
  const periode = { from: '2026-10-06', to: '2026-10-31', weekdays: [1, 3], mode: 'slots', slots: [{ start: '14:00', end: '22:00' }], createdAt: T(1) };
  it('s’appliquent sur la période, aux jours choisis seulement', () => {
    assert.equal(jourDe('2026-10-12', [periode]).plages[0].start, '14:00', 'lundi dans la période');
    assert.equal(jourDe('2026-10-14', [periode]).plages[0].start, '14:00', 'mercredi dans la période');
    assert.equal(jourDe('2026-10-13', [periode]).source, 'semaine', 'mardi : jour non choisi');
    assert.equal(jourDe('2026-11-02', [periode]).source, 'semaine', 'après la période');
    assert.equal(jourDe('2026-10-05', [periode]).source, 'semaine', 'avant la période');
  });
  it('bornes incluses ; sans jours choisis = tous les jours', () => {
    const tous = { ...periode, weekdays: [] };
    assert.equal(jourDe('2026-10-06', [tous]).source, 'date');
    assert.equal(jourDe('2026-10-31', [tous]).source, 'date');
    assert.equal(jourDe('2026-10-11', [tous]).ouvert, true, 'un dimanche ouvert par un réglage');
  });
  it('« fermé » ferme ; des plages vides ferment aussi', () => {
    assert.deepEqual(jourDe('2026-10-12', [{ ...periode, mode: 'closed', slots: [] }]), { ouvert: false, plages: [], source: 'date' });
    assert.equal(jourDe('2026-10-12', [{ ...periode, slots: [] }]).ouvert, false);
  });
  it('le réglage le plus RÉCENT l’emporte, quel que soit l’ordre de lecture', () => {
    const conges = { from: '2026-10-19', to: '2026-10-19', weekdays: [], mode: 'closed', slots: [], createdAt: T(2) };
    for (const dates of [[periode, conges], [conges, periode]]) {
      assert.equal(jourDe('2026-10-19', dates).ouvert, false, 'le lundi 19 : congé posé après');
      assert.equal(jourDe('2026-10-12', dates).plages[0].start, '14:00', 'les autres lundis gardent la période');
    }
    const ancien = { ...conges, createdAt: T(0) };
    assert.equal(jourDe('2026-10-19', [periode, ancien]).plages[0].start, '14:00', 'un réglage plus ancien est recouvert');
  });
  it('« horaires habituels » par-dessus rend la semaine type sur ces jours', () => {
    const retour = { from: '2026-10-19', to: '2026-10-25', weekdays: [], mode: 'usual', slots: [], createdAt: T(3) };
    assert.equal(jourDe('2026-10-19', [periode, retour]).plages[0].start, '09:00');
  });
});

describe('option « horaires variables »', () => {
  it('sans réglage daté : fermé, même un jour ouvert dans la semaine type', () => {
    assert.deepEqual(jourDe('2026-10-05', [], true), { ouvert: false, plages: [], source: 'variables' });
  });
  it('ouvert seulement les jours réglés', () => {
    const jour = { from: '2026-10-07', to: '2026-10-07', weekdays: [], mode: 'slots', slots: [{ start: '10:00', end: '16:00' }], createdAt: T(1) };
    assert.equal(jourDe('2026-10-07', [jour], true).ouvert, true);
    assert.equal(jourDe('2026-10-08', [jour], true).ouvert, false);
  });
  it('« horaires habituels » = fermé pour un membre à horaires variables', () => {
    const retour = { from: '2026-10-07', to: '2026-10-07', weekdays: [], mode: 'usual', slots: [], createdAt: T(1) };
    assert.equal(jourDe('2026-10-07', [retour], true).ouvert, false);
  });
});

describe('validation d’un réglage', () => {
  const ok = { from: '2026-10-06', to: '2026-10-31', weekdays: [1], mode: 'slots', slots: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '18:00' }] };
  it('accepte un réglage correct, « fermé » et « habituel » sans plages', () => {
    assert.equal(raisonHorairesDatesInvalides(ok), null);
    assert.equal(raisonHorairesDatesInvalides({ ...ok, mode: 'closed', slots: [] }), null);
    assert.equal(raisonHorairesDatesInvalides({ ...ok, mode: 'usual', slots: [] }), null);
    assert.equal(raisonHorairesDatesInvalides({ ...ok, slots: [{ start: '18:00', end: '24:00' }] }), null, 'jusqu’à minuit');
  });
  it('refuse : dates, ordre, durée, jours, mode, plages', () => {
    assert.equal(raisonHorairesDatesInvalides({ ...ok, from: '6/10/2026' }), 'dates');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, to: '2026-10-05' }), 'ordre');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, to: '2027-10-06' }), null, '366 jours bornes incluses : la limite');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, to: '2027-10-07' }), 'duree');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, weekdays: [7] }), 'jours');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, mode: 'ouvert' }), 'mode');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, slots: [] }), 'aucunePlage');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, slots: [{ start: '12:00', end: '09:00' }] }), 'plage');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, slots: [{ start: '9h', end: '12:00' }] }), 'plage');
    assert.equal(raisonHorairesDatesInvalides({ ...ok, slots: [{ start: '09:00', end: '13:00' }, { start: '12:00', end: '15:00' }] }), 'chevauchement');
  });
});

describe('copier une semaine sur les suivantes', () => {
  // Semaine du lundi 5 octobre, telle qu'elle s'applique.
  const lundi = '2026-10-05';
  const source = [0, 1, 2, 3, 4, 5, 6].map((i) => jourDe(ajouterJours(lundi, i), [
    { from: '2026-10-07', to: '2026-10-07', weekdays: [], mode: 'slots', slots: [{ start: '14:00', end: '22:00' }], createdAt: T(1) },
  ]));
  const reglages = copierSemaine(source, '2026-10-12', 4, ajouterJours);

  it('au plus 7 réglages, regroupés par horaires identiques, sur toute la période visée', () => {
    assert.ok(reglages.length <= 7);
    assert.equal(reglages.length, 3, 'lun-mar-jeu-ven 9h–18h · mer 14h–22h · sam-dim fermés');
    for (const r of reglages) {
      assert.equal(r.from, '2026-10-12');
      assert.equal(r.to, '2026-11-08', '4 semaines, dimanche inclus');
    }
  });
  it('rejouée, chaque jour des 4 semaines reproduit la semaine source', () => {
    const dates = reglages.map((r, i) => ({ ...r, createdAt: T(10 + i) }));
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 7; i++) {
        const cible = ajouterJours('2026-10-12', s * 7 + i);
        const h = jourDe(cible, dates, true); // même en horaires variables : tout est explicite
        assert.deepEqual({ ouvert: h.ouvert, plages: h.plages }, { ouvert: source[i].ouvert, plages: source[i].plages }, cible);
      }
    }
    assert.equal(jourDe('2026-11-09', dates, true).ouvert, false, 'rien au-delà');
  });
  it('refuse une semaine incomplète ou un nombre invalide', () => {
    assert.throws(() => copierSemaine(source.slice(0, 6), '2026-10-12', 2, ajouterJours));
    assert.throws(() => copierSemaine(source, '2026-10-12', 0, ajouterJours));
  });
});

describe('réglage du jour — utilitaire', () => {
  it('aucun réglage → null', () => {
    assert.equal(reglageDateDuJour([], '2026-10-05', 1), null);
  });
});
