import { describe, it, expect } from 'vitest';
import {
  resolveTravelTier,
  travelZoneLimitKm,
  roundCoordinate,
  isValidTravelZone,
} from './travel';
import { isClientAddressRevealed } from './address';
import { travelZoneTiersSchema } from '../schemas/location.schema';

/**
 * Paliers de frais de déplacement — chaque cas ancre une décision produit :
 * borne INCLUSE, blocage net hors zone, fee 0 = offert, bornes strictement
 * croissantes, et la révélation de l'adresse cliente à la confirmation.
 */

const paliers = [
  { maxKm: 5, fee: 0 },      // offert jusqu'à 5 km
  { maxKm: 10, fee: 500 },
  { maxKm: 20, fee: 1200 },  // limite de zone : 20 km
];

describe('resolveTravelTier — borne incluse, hors zone = null', () => {
  it('distance 0 → premier palier (offert)', () => {
    expect(resolveTravelTier(paliers, 0)?.fee).toBe(0);
  });

  it('borne EXACTE → le palier est inclus (5 km → offert, pas 5 €)', () => {
    expect(resolveTravelTier(paliers, 5)?.fee).toBe(0);
    expect(resolveTravelTier(paliers, 10)?.fee).toBe(500);
    expect(resolveTravelTier(paliers, 20)?.fee).toBe(1200);
  });

  it('juste au-delà d\'une borne → palier suivant', () => {
    expect(resolveTravelTier(paliers, 5.1)?.fee).toBe(500);
    expect(resolveTravelTier(paliers, 10.1)?.fee).toBe(1200);
  });

  it('au-delà du dernier palier → null (blocage net)', () => {
    expect(resolveTravelTier(paliers, 20.1)).toBe(null);
    expect(resolveTravelTier(paliers, 100)).toBe(null);
  });

  it('liste vide, distance négative ou NaN → null', () => {
    expect(resolveTravelTier([], 3)).toBe(null);
    expect(resolveTravelTier(paliers, -1)).toBe(null);
    expect(resolveTravelTier(paliers, NaN)).toBe(null);
  });

  it('travelZoneLimitKm = borne du dernier palier', () => {
    expect(travelZoneLimitKm(paliers)).toBe(20);
    expect(travelZoneLimitKm([])).toBe(null);
    expect(travelZoneLimitKm(null)).toBe(null);
  });
});

describe('travelZoneTiersSchema — la structure est verrouillée', () => {
  it('accepte une zone valide (avec fee 0)', () => {
    expect(travelZoneTiersSchema.safeParse(paliers).success).toBe(true);
  });

  it('rejette bornes non croissantes et bornes égales', () => {
    expect(travelZoneTiersSchema.safeParse([{ maxKm: 10, fee: 0 }, { maxKm: 5, fee: 500 }]).success).toBe(false);
    expect(travelZoneTiersSchema.safeParse([{ maxKm: 10, fee: 0 }, { maxKm: 10, fee: 500 }]).success).toBe(false);
  });

  it('rejette liste vide, 9 paliers, fee négatif ou non entier, borne > 300', () => {
    expect(travelZoneTiersSchema.safeParse([]).success).toBe(false);
    const neuf = Array.from({ length: 9 }, (_, i) => ({ maxKm: (i + 1) * 5, fee: 100 }));
    expect(travelZoneTiersSchema.safeParse(neuf).success).toBe(false);
    expect(travelZoneTiersSchema.safeParse([{ maxKm: 5, fee: -100 }]).success).toBe(false);
    expect(travelZoneTiersSchema.safeParse([{ maxKm: 5, fee: 10.5 }]).success).toBe(false);
    expect(travelZoneTiersSchema.safeParse([{ maxKm: 400, fee: 100 }]).success).toBe(false);
  });

  it('isValidTravelZone (miroir pur pour les formulaires) suit les mêmes règles', () => {
    expect(isValidTravelZone(paliers)).toBe(true);
    expect(isValidTravelZone([])).toBe(false);
    expect(isValidTravelZone([{ maxKm: 10, fee: 0 }, { maxKm: 10, fee: 500 }])).toBe(false);
    expect(isValidTravelZone([{ maxKm: 5, fee: -1 }])).toBe(false);
  });
});

describe('roundCoordinate — clés de cache stables', () => {
  it('4 décimales (~11 m)', () => {
    expect(roundCoordinate(48.856614, 4)).toBe(48.8566);
    expect(roundCoordinate(2.352222, 4)).toBe(2.3522);
    // Math.round arrondit ,5 vers +∞ (sémantique JS) — seule la stabilité
    // de la clé compte, pas le sens de l'arrondi.
    expect(roundCoordinate(-1.98765, 4)).toBe(-1.9876);
  });
});

describe("isClientAddressRevealed — l'adresse cliente n'apparaît qu'à la confirmation", () => {
  it('confirmed et completed → visible', () => {
    expect(isClientAddressRevealed({ status: 'confirmed' })).toBe(true);
    expect(isClientAddressRevealed({ status: 'completed' })).toBe(true);
  });

  it('pending, pending_payment, cancelled, noshow → ville seule', () => {
    expect(isClientAddressRevealed({ status: 'pending' })).toBe(false);
    expect(isClientAddressRevealed({ status: 'pending_payment' })).toBe(false);
    expect(isClientAddressRevealed({ status: 'cancelled' })).toBe(false);
    expect(isClientAddressRevealed({ status: 'noshow' })).toBe(false);
  });
});
