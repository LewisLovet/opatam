import { describe, expect, it } from 'vitest';
import {
  SERVICE_BASE_DURATION_MAX,
  deriveServiceBasePricing,
  getServiceMinDuration,
} from './service-pricing';
import { createServiceSchema } from '../schemas/service.schema';

/** Prestation longue type « box braids » : la combinaison la PLUS COURTE
 *  dépasse déjà 8 h — c'est le cas qui était tronqué. */
const longService = {
  price: 0,
  duration: 0,
  variations: [
    {
      id: 'v1',
      name: 'Longueur',
      required: true,
      options: [
        { id: 'o1', label: 'Épaules', price: 12000, duration: 540 }, // 9 h
        { id: 'o2', label: 'Mi-dos', price: 15000, duration: 660 },
        { id: 'o3', label: 'Taille', price: 18000, duration: 780 },
      ],
    },
    {
      id: 'v2',
      name: 'Densité',
      required: true,
      options: [
        { id: 'd1', label: 'Classique', price: 0, duration: 0 },
        { id: 'd2', label: 'Dense', price: 3000, duration: 90 },
      ],
    },
  ],
};

describe('deriveServiceBasePricing — plafond de durée', () => {
  it('ne tronque plus une prestation dont la combinaison la plus courte dépasse 8 h', () => {
    const minimum = getServiceMinDuration(longService as never);
    expect(minimum).toBe(540);

    const derived = deriveServiceBasePricing(longService as never);
    // Régression : le plafond de 480 min renvoyait 480, et
    // `getAvailableSlots` proposait alors des créneaux de 8 h pour une
    // prestation de 9 h AVANT que le client ait choisi ses options.
    expect(derived.duration).toBe(540);
    expect(derived.price).toBe(12000);
  });

  it('le plafond de base est aligné sur celui des options de variation (24 h)', () => {
    expect(SERVICE_BASE_DURATION_MAX).toBe(1440);
  });

  it('borne toujours les cas dégénérés à 24 h', () => {
    const absurde = {
      price: 0,
      duration: 0,
      variations: [
        {
          id: 'v1',
          name: 'Longueur',
          required: true,
          options: [{ id: 'o1', label: 'XL', price: 100, duration: 1440 }],
        },
        {
          id: 'v2',
          name: 'Finition',
          required: true,
          options: [{ id: 'o2', label: 'Soin', price: 100, duration: 600 }],
        },
      ],
    };
    expect(getServiceMinDuration(absurde as never)).toBe(2040);
    expect(deriveServiceBasePricing(absurde as never).duration).toBe(1440);
  });

  it('sans variation, la durée saisie est conservée telle quelle', () => {
    const simple = { price: 3000, duration: 45, variations: [] };
    expect(deriveServiceBasePricing(simple as never)).toEqual({ price: 3000, duration: 45 });
  });
});

describe('createServiceSchema — durée', () => {
  const base = {
    name: 'Box braids',
    price: 12000,
    duration: 540,
    category: 'Coiffure',
    isActive: true,
  };

  it('accepte une durée de base supérieure à 8 h', () => {
    expect(createServiceSchema.safeParse(base).success).toBe(true);
  });

  it('accepte 24 h pile', () => {
    expect(createServiceSchema.safeParse({ ...base, duration: 1440 }).success).toBe(true);
  });

  it('refuse au-delà de 24 h', () => {
    expect(createServiceSchema.safeParse({ ...base, duration: 1441 }).success).toBe(false);
  });

  it('refuse toujours en dessous de 5 min', () => {
    expect(createServiceSchema.safeParse({ ...base, duration: 4 }).success).toBe(false);
  });
});
