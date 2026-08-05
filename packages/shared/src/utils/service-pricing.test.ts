import { describe, expect, it } from 'vitest';
import {
  SERVICE_BASE_DURATION_MAX,
  buildPromoWindows,
  buildServiceDiscountPreview,
  computeDiscountedTotal,
  deriveServiceBasePricing,
  formatDiscountBadge,
  getActiveDiscount,
  getActivePromoPercentFromWindows,
  getDiscountReduction,
  getDiscountedMinPrice,
  getServiceMinDuration,
  hasActivePromoFromWindows,
} from './service-pricing';
import type { ServiceSelections } from './service-pricing';
import type { Service } from '../types';
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

// ─── Promotions en montant fixe ──────────────────────────────────────────

/** Prestation à variations : « Coupe » 30 € ou 45 €, option « Soin » +10 €.
 *  Typée explicitement : les tests la SPREADENT pour lui greffer une promo,
 *  ce qu'un `as never` interdit. */
const promoService: Pick<
  Service,
  'price' | 'duration' | 'variations' | 'options' | 'discount'
> = {
  price: 0,
  duration: 60,
  variations: [
    {
      id: 'v1',
      name: 'Formule',
      options: [
        { id: 'o1', name: 'Simple', price: 3000, duration: 60 },
        { id: 'o2', name: 'Complète', price: 4500, duration: 90 },
      ],
    },
  ],
  options: [
    {
      id: 'a1',
      name: 'Soin',
      price: 1000,
      duration: 15,
      nestedVariations: [],
      nestedInfoFields: [],
    },
  ],
  discount: null,
};

const pick = (variationOption: string, addOn = false): ServiceSelections => ({
  variations: { v1: variationOption },
  options: addOn ? { a1: { nestedVariations: {}, infoValues: {} } } : {},
  infoValues: {},
});

describe('getDiscountReduction', () => {
  it('applique un pourcentage sur le sous-total', () => {
    expect(getDiscountReduction(4000, { percent: 20 })).toBe(800);
  });

  it('retire un montant fixe', () => {
    expect(getDiscountReduction(4000, { amount: 1000 })).toBe(1000);
  });

  it('PLAFONNE le montant au sous-total remisable', () => {
    // « −20 € » sur une prestation à 15 € ne doit pas produire un prix négatif.
    expect(getDiscountReduction(1500, { amount: 2000 })).toBe(1500);
  });

  it('ne réduit rien sans promo ni sur un sous-total nul', () => {
    expect(getDiscountReduction(4000, null)).toBe(0);
    expect(getDiscountReduction(0, { amount: 1000 })).toBe(0);
  });

  it('fait primer le montant quand les deux champs coexistent', () => {
    // Le schéma l'interdit ; si un document contourne la validation, le
    // comportement doit rester défini.
    expect(getDiscountReduction(4000, { percent: 50, amount: 500 })).toBe(500);
  });
});

describe('getActiveDiscount — montant', () => {
  it('accepte une promo en montant', () => {
    expect(getActiveDiscount({ amount: 1000 })).not.toBeNull();
  });

  it('refuse une promo sans valeur exploitable', () => {
    expect(getActiveDiscount({ amount: 0 })).toBeNull();
    expect(getActiveDiscount({ percent: 0 })).toBeNull();
    expect(getActiveDiscount({} as never)).toBeNull();
  });

  it('respecte la fenêtre de dates comme pour un pourcentage', () => {
    const at = new Date('2026-08-10T12:00:00Z');
    expect(getActiveDiscount({ amount: 1000, endsAt: '2026-08-01' }, at)).toBeNull();
    expect(getActiveDiscount({ amount: 1000, startsAt: '2026-08-20' }, at)).toBeNull();
    expect(getActiveDiscount({ amount: 1000, startsAt: '2026-08-01' }, at)).not.toBeNull();
  });
});

describe('computeDiscountedTotal — montant fixe', () => {
  it('retire le montant du total remisable', () => {
    const r = computeDiscountedTotal(promoService, pick('o1'), { amount: 1000 });
    expect(r.original).toBe(3000);
    expect(r.price).toBe(2000);
    expect(r.discountAmount).toBe(1000);
    expect(r.discountPercent).toBeNull();
  });

  it('ne descend jamais sous zéro', () => {
    const r = computeDiscountedTotal(promoService, pick('o1'), { amount: 999999 });
    expect(r.price).toBe(0);
  });

  it('exclut les lignes non concernées du sous-total remisable', () => {
    // L'option « Soin » est exclue : elle reste à 10 €, et la remise de 10 €
    // ne peut mordre que sur les 30 € de la formule.
    const r = computeDiscountedTotal(promoService, pick('o1', true), {
      amount: 1000,
      excludedIds: ['a1'],
    });
    expect(r.original).toBe(4000);
    expect(r.price).toBe(3000);
  });

  it('plafonne au sous-total ÉLIGIBLE, pas au total', () => {
    const r = computeDiscountedTotal(promoService, pick('o1', true), {
      amount: 5000,
      excludedIds: ['o1'],
    });
    // Seule l'option de 10 € est éligible : on ne peut retirer que 10 €.
    expect(r.original).toBe(4000);
    expect(r.price).toBe(3000);
  });

  it('laisse le pourcentage inchangé (non-régression)', () => {
    const r = computeDiscountedTotal(promoService, pick('o2'), { percent: 20 });
    expect(r.price).toBe(3600);
    expect(r.discountPercent).toBe(20);
    expect(r.discountAmount).toBeNull();
  });
});

describe('getDiscountedMinPrice — montant fixe', () => {
  it('remise sur la combinaison la moins chère', () => {
    const r = getDiscountedMinPrice({ ...promoService, discount: { amount: 1000 } });
    expect(r.original).toBe(3000);
    expect(r.price).toBe(2000);
    expect(r.discountAmount).toBe(1000);
  });

  it('promo boutique appliquée à défaut de promo prestation', () => {
    const r = getDiscountedMinPrice({ ...promoService, discount: null }, {
      amount: 500,
    });
    expect(r.price).toBe(2500);
  });

  it('la promo de la prestation prime sur celle de la boutique', () => {
    const r = getDiscountedMinPrice(
      { ...promoService, discount: { amount: 1000 } },
      { percent: 50 },
    );
    expect(r.price).toBe(2000);
    expect(r.discountPercent).toBeNull();
  });
});

describe('buildServiceDiscountPreview — montant fixe', () => {
  it('laisse les lignes intactes et porte la remise sur le total', () => {
    const p = buildServiceDiscountPreview(promoService, { amount: 1000 })!;
    expect(p.amount).toBe(1000);
    expect(p.percent).toBe(0);
    // Un montant ne se répartit pas : chaque ligne garde son prix.
    expect(p.variations[0].rows.every((r) => r.discounted === r.original)).toBe(true);
    // Total « tout choisi » : 30 + 45 + 10 = 85 €, moins 10 €.
    expect(p.total.original).toBe(8500);
    expect(p.total.discounted).toBe(7500);
  });

  it('retire les lignes exclues du sous-total remisable', () => {
    const p = buildServiceDiscountPreview(promoService, {
      amount: 1000,
      excludedIds: ['a1'],
    })!;
    expect(p.total.discountable).toBe(7500);
    expect(p.options[0].applies).toBe(false);
  });

  it('conserve l’avant/après par ligne en pourcentage (non-régression)', () => {
    const p = buildServiceDiscountPreview(promoService, { percent: 10 })!;
    expect(p.variations[0].rows[0].discounted).toBe(2700);
    expect(p.amount).toBeNull();
  });
});

describe('buildPromoWindows — montant fixe', () => {
  it('recopie le montant dans le résumé dénormalisé', () => {
    const w = buildPromoWindows({ amount: 1500 }, []);
    expect(w).toHaveLength(1);
    expect(w[0].amount).toBe(1500);
    // Firestore refuse `undefined` : le champ inutilisé doit être ABSENT.
    expect('percent' in w[0]).toBe(false);
  });

  it('écarte les fenêtres expirées', () => {
    const at = new Date('2026-08-10T12:00:00Z');
    expect(buildPromoWindows({ amount: 1500, endsAt: '2026-08-01' }, [], at)).toHaveLength(0);
  });

  it('hasActivePromoFromWindows voit une promo en montant que le pourcentage ignore', () => {
    const windows = buildPromoWindows({ amount: 1500 }, []);
    expect(getActivePromoPercentFromWindows(windows)).toBe(0);
    expect(hasActivePromoFromWindows(windows)).toBe(true);
  });
});

describe('formatDiscountBadge', () => {
  // `Intl` insère une espace fine insécable (U+202F) avant le symbole en
  // français : on normalise TOUTES les espaces, sinon l'assertion échoue sur
  // une différence invisible à l'œil.
  const norm = (v: string | null) => v?.replace(/[\s\u00A0\u202F]+/g, ' ') ?? null;

  it('formate un pourcentage', () => {
    expect(formatDiscountBadge({ percent: 20 })).toBe('−20%');
  });

  it('formate un montant rond sans décimales', () => {
    expect(norm(formatDiscountBadge({ amount: 1000 }))).toBe('−10 €');
  });

  it('garde les centimes quand il y en a', () => {
    expect(norm(formatDiscountBadge({ amount: 1050 }))).toBe('−10,50 €');
  });

  it('retourne null sans valeur exploitable', () => {
    expect(formatDiscountBadge(null)).toBeNull();
    expect(formatDiscountBadge({ amount: 0 })).toBeNull();
  });
});
