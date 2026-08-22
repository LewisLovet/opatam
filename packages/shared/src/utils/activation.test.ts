import { describe, it, expect } from 'vitest';
import { computeActivation } from './activation';

const base = { isPublished: true, activeServicesCount: 3, hasAvailability: true, realBookingsCount: 1 };

describe('computeActivation — la définition officielle', () => {
  it('les quatre critères remplis → activé, score 4, aucune étape suivante', () => {
    const a = computeActivation(base);
    expect(a.activated).toBe(true);
    expect(a.score).toBe(4);
    expect(a.nextStep).toBe(null);
  });

  it("un compte inscrit mais vide n'est PAS activé — c'est tout le sens de la métrique", () => {
    const a = computeActivation({ isPublished: false, activeServicesCount: 0, hasAvailability: false, realBookingsCount: 0 });
    expect(a.activated).toBe(false);
    expect(a.score).toBe(0);
    expect(a.nextStep).toBe('prestations');
  });

  it('2 prestations ne suffisent pas, 3 oui', () => {
    expect(computeActivation({ ...base, activeServicesCount: 2 }).activated).toBe(false);
    expect(computeActivation({ ...base, activeServicesCount: 3 }).activated).toBe(true);
  });

  it("dépublier fait PERDRE l'activation — rien n'est matérialisé", () => {
    const a = computeActivation({ ...base, isPublished: false });
    expect(a.activated).toBe(false);
    expect(a.nextStep).toBe('publier');
  });

  it("la prochaine action suit le parcours réel : prestations → disponibilités → publier → réservation", () => {
    expect(computeActivation({ isPublished: false, activeServicesCount: 0, hasAvailability: false, realBookingsCount: 0 }).nextStep).toBe('prestations');
    expect(computeActivation({ isPublished: false, activeServicesCount: 3, hasAvailability: false, realBookingsCount: 0 }).nextStep).toBe('disponibilites');
    expect(computeActivation({ isPublished: false, activeServicesCount: 3, hasAvailability: true, realBookingsCount: 0 }).nextStep).toBe('publier');
    expect(computeActivation({ ...base, realBookingsCount: 0 }).nextStep).toBe('premiere_reservation');
  });

  it('les pages vues ne comptent jamais dans le score', () => {
    const sans = computeActivation({ ...base, realBookingsCount: 0 });
    const avec = computeActivation({ ...base, realBookingsCount: 0, pageViewsTotal: 5000 });
    expect(avec.score).toBe(sans.score);
    expect(avec.activated).toBe(false);
  });
});
