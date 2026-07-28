import { describe, expect, it } from 'vitest';
import { closedBands, mergeRanges } from './workingRanges';

const h = (hour: number, min = 0) => hour * 60 + min;

describe('mergeRanges', () => {
  it('fusionne deux plages qui se chevauchent', () => {
    expect(mergeRanges([{ start: h(9), end: h(13) }, { start: h(12), end: h(18) }])).toEqual([
      { start: h(9), end: h(18) },
    ]);
  });

  it('fusionne deux plages qui se touchent bout à bout', () => {
    expect(mergeRanges([{ start: h(9), end: h(12) }, { start: h(12), end: h(18) }])).toEqual([
      { start: h(9), end: h(18) },
    ]);
  });

  it('préserve une vraie coupure déjeuner', () => {
    const journee = [
      { start: h(9), end: h(12) },
      { start: h(14), end: h(19) },
    ];
    expect(mergeRanges(journee)).toEqual(journee);
  });

  it('trie avant de fusionner (les créneaux ne sont pas garantis ordonnés)', () => {
    expect(
      mergeRanges([{ start: h(14), end: h(19) }, { start: h(9), end: h(12) }]),
    ).toEqual([
      { start: h(9), end: h(12) },
      { start: h(14), end: h(19) },
    ]);
  });

  it('ne mute pas le tableau reçu', () => {
    const source = [{ start: h(9), end: h(12) }, { start: h(11), end: h(18) }];
    mergeRanges(source);
    expect(source).toEqual([{ start: h(9), end: h(12) }, { start: h(11), end: h(18) }]);
  });
});

describe('closedBands', () => {
  it('encadre une journée continue : avant et après', () => {
    // Grille 7h→21h, ouvert 9h→19h.
    expect(closedBands([{ start: h(9), end: h(19) }], h(7), h(21))).toEqual([
      { start: h(7), end: h(9) },
      { start: h(19), end: h(21) },
    ]);
  });

  it('creuse la coupure déjeuner', () => {
    expect(
      closedBands(
        [
          { start: h(9), end: h(12) },
          { start: h(14), end: h(19) },
        ],
        h(7),
        h(21),
      ),
    ).toEqual([
      { start: h(7), end: h(9) },
      { start: h(12), end: h(14) },
      { start: h(19), end: h(21) },
    ]);
  });

  it('journée fermée = fenêtre entière voilée', () => {
    // C'est l'information la plus utile du planning : un jour off doit se
    // voir d'un coup d'œil.
    expect(closedBands([], h(7), h(21))).toEqual([{ start: h(7), end: h(21) }]);
  });

  it('journée entièrement couverte = rien à voiler', () => {
    expect(closedBands([{ start: h(0), end: h(24) }], h(7), h(21))).toEqual([]);
  });

  it('ignore ce qui déborde de la fenêtre visible', () => {
    // Ouvert 6h→22h alors que la grille n'affiche que 7h→21h.
    expect(closedBands([{ start: h(6), end: h(22) }], h(7), h(21))).toEqual([]);
  });

  it('gère une plage à cheval sur le bord gauche', () => {
    expect(closedBands([{ start: h(6), end: h(10) }], h(7), h(21))).toEqual([
      { start: h(10), end: h(21) },
    ]);
  });

  it('gère des plages non triées', () => {
    expect(
      closedBands(
        [
          { start: h(14), end: h(19) },
          { start: h(9), end: h(12) },
        ],
        h(7),
        h(21),
      ),
    ).toEqual([
      { start: h(7), end: h(9) },
      { start: h(12), end: h(14) },
      { start: h(19), end: h(21) },
    ]);
  });

  it('gère les demi-heures', () => {
    expect(closedBands([{ start: h(9, 30), end: h(18, 15) }], h(9), h(19))).toEqual([
      { start: h(9), end: h(9, 30) },
      { start: h(18, 15), end: h(19) },
    ]);
  });

  it('fenêtre dégénérée = aucune bande (jamais de hauteur négative)', () => {
    // Une hauteur négative ferait planter le moteur de style natif.
    expect(closedBands([{ start: h(9), end: h(19) }], h(21), h(21))).toEqual([]);
    expect(closedBands([], h(21), h(7))).toEqual([]);
  });
});
