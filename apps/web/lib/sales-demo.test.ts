import { describe, it, expect } from 'vitest';
import { parseDemoConfig, extraireJson } from './sales-demo';

const valide = JSON.stringify({
  businessName: 'Chez Awa',
  categories: [
    { name: 'Tresses', services: [
      { name: 'Box braids', price: 80, duration: 180 },
      { name: 'Nattes collées', price: 45.5, duration: 90,
        variations: [{ name: 'Longueur', options: [
          { name: 'Courtes', price: 45.5 }, { name: 'Longues', price: 60 },
        ] }] },
    ] },
  ],
});

describe('parseDemoConfig — la frontière entre l’IA et la page', () => {
  it('un JSON propre passe, prix convertis en centimes', () => {
    const r = parseDemoConfig(valide);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.categories[0].services[0].price).toBe(8000);
      expect(r.config.categories[0].services[1].price).toBe(4550);
      expect(r.config.categories[0].services[1].variations![0].options[1].price).toBe(6000);
    }
  });

  it("l'enrobage markdown des IA est retiré", () => {
    const r = parseDemoConfig('Voici le JSON demandé :\n```json\n' + valide + '\n```\nBonne journée !');
    expect(r.ok).toBe(true);
  });

  it('du texte avant/après le JSON, sans fence, passe aussi', () => {
    expect(parseDemoConfig('Bien sûr ! ' + valide).ok).toBe(true);
  });

  it('les erreurs sortent en français, avec le chemin du champ', () => {
    const r = parseDemoConfig(JSON.stringify({ businessName: 'X', categories: [{ name: 'A', services: [{ name: '', price: -5 }] }] }));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erreurs.some((e) => e.includes('prestation'))).toBe(true);
      expect(r.erreurs.some((e) => e.includes('négatif'))).toBe(true);
    }
  });

  it('un collage qui n’est pas du JSON explique quoi faire', () => {
    const r = parseDemoConfig('désolé je ne peux pas vous aider');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs[0].includes('accolade')).toBe(true);
  });

  it('une variation à un seul choix est refusée', () => {
    const r = parseDemoConfig(JSON.stringify({
      businessName: 'X',
      categories: [{ name: 'A', services: [{ name: 'S', price: 10, duration: 30,
        variations: [{ name: 'V', options: [{ name: 'seul', price: 10 }] }] }] }],
    }));
    expect(r.ok).toBe(false);
  });

  it('extraireJson isole le premier objet complet', () => {
    expect(extraireJson('blah {"a":1} blah')).toBe('{"a":1}');
  });

  it('les suppléments (options) passent, en centimes, durée facultative', () => {
    const r = parseDemoConfig(JSON.stringify({
      businessName: 'X',
      categories: [{ name: 'A', services: [{ name: 'S', price: 40, duration: 60,
        options: [{ name: 'Soin profond', price: 10, duration: 15 }, { name: 'Brillance', price: 5 }] }] }],
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const sup = r.config.categories[0].services[0].options!;
      expect(sup[0].price).toBe(1000);
      expect(sup[0].duration).toBe(15);
      expect(sup[1].price).toBe(500);
      expect(sup[1].duration).toBe(undefined);
    }
  });

  it('brandColor accepte le hex avec ou sans #, refuse le reste', () => {
    const base = { businessName: 'X', categories: [{ name: 'A', services: [{ name: 'S', price: 10 }] }] };
    const avec = parseDemoConfig(JSON.stringify({ ...base, brandColor: '7c3aed' }));
    expect(avec.ok).toBe(true);
    if (avec.ok) expect(avec.config.brandColor).toBe('#7c3aed');
    expect(parseDemoConfig(JSON.stringify({ ...base, brandColor: 'violet' })).ok).toBe(false);
  });
});
