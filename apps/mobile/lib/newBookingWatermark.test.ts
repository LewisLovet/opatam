import { describe, expect, it } from 'vitest';
import { decideNewBookingMoment } from './newBookingWatermark';

/** Trois instants, du plus ancien au plus récent. */
const T1 = 1_700_000_000_000;
const T2 = T1 + 60_000;
const T3 = T2 + 60_000;

describe('decideNewBookingMoment — première consultation', () => {
  it('ne compte rien et pose le repère', () => {
    // Sans ça, tout l'historique d'un prestataire déjà installé passerait
    // pour une bonne nouvelle le jour de la mise à jour.
    expect(decideNewBookingMoment(T2, null)).toEqual({
      shouldCount: false,
      nextWatermark: T2,
    });
  });

  it('traite un repère illisible comme une première consultation', () => {
    expect(decideNewBookingMoment(T2, 'oups')).toEqual({
      shouldCount: false,
      nextWatermark: T2,
    });
  });
});

describe('decideNewBookingMoment — consultations suivantes', () => {
  it('compte une réservation plus récente que le repère', () => {
    expect(decideNewBookingMoment(T3, String(T2))).toEqual({
      shouldCount: true,
      nextWatermark: T3,
    });
  });

  it('ne compte rien quand rien n’a bougé', () => {
    expect(decideNewBookingMoment(T2, String(T2))).toEqual({
      shouldCount: false,
      nextWatermark: null,
    });
  });

  it('ne FAIT PAS RECULER le repère sur un affichage plus étroit', () => {
    // Le piège : le pro passe le filtre de « ce mois » à « aujourd'hui ».
    // La création la plus récente affichée redevient ancienne. Rabaisser le
    // repère ferait recompter les résas déjà vues à la visite suivante.
    expect(decideNewBookingMoment(T1, String(T3))).toEqual({
      shouldCount: false,
      nextWatermark: null,
    });
  });

  it('après un affichage plus étroit, seule une VRAIE nouveauté compte', () => {
    // Enchaînement complet : repère à T2, vue étroite à T1 (rien), puis une
    // nouvelle résa à T3 → un seul moment compté.
    const narrowed = decideNewBookingMoment(T1, String(T2));
    expect(narrowed.shouldCount).toBe(false);
    const watermark = narrowed.nextWatermark ?? T2;
    expect(decideNewBookingMoment(T3, String(watermark))).toEqual({
      shouldCount: true,
      nextWatermark: T3,
    });
  });
});

describe('decideNewBookingMoment — entrées inexploitables', () => {
  it('ignore un planning sans aucune réservation', () => {
    // 0 = aucune création retenue par l'écran.
    expect(decideNewBookingMoment(0, String(T2))).toEqual({
      shouldCount: false,
      nextWatermark: null,
    });
  });

  it('ignore une date invalide sans toucher au repère', () => {
    expect(decideNewBookingMoment(NaN, String(T2))).toEqual({
      shouldCount: false,
      nextWatermark: null,
    });
  });
});
