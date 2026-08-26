import { describe, it, expect } from 'vitest';
import { parseDemoConfig, extraireJson, prixEffectif, configEnEuros } from './sales-demo';

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
  it('guillemets typographiques (GPT/Word) normalisés, apostrophes françaises intactes', () => {
    // Cas réel « ZS institut » (2026-08) : GPT avait rendu tout le JSON en
    // guillemets courbes — refusé alors que le contenu était irréprochable.
    const courbes = '{\u201CbusinessName\u201D: \u201CZS institut\u201D, \u201Ccategories\u201D: [{\u201Cname\u201D: \u201CManucure\u201D, \u201Cservices\u201D: [{\u201Cname\u201D: \u201CRemplissage d\u2019une pose\u201D, \u201Cprice\u201D: 30, \u201Cduration\u201D: 75}]}]}';
    const r = parseDemoConfig(courbes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.businessName).toBe('ZS institut');
      // L'apostrophe typographique du texte n'est PAS touchée.
      expect(r.config.categories[0].services[0].name).toBe('Remplissage d\u2019une pose');
    }
  });

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

  it('une prestation sans prix (« sur devis ») passe la validation', () => {
    const r = parseDemoConfig(JSON.stringify({
      businessName: 'X',
      categories: [{ name: 'A', services: [
        { name: 'Nail art', description: 'Sur devis', duration: 30 },
        { name: 'Pose gel', price: 45, duration: 90 },
      ] }],
    }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(prixEffectif(r.config.categories[0].services[0])).toBe(null);
      expect(prixEffectif(r.config.categories[0].services[1])).toBe(4500);
    }
  });

  it('prixEffectif retombe sur le choix le moins cher des variations', () => {
    expect(prixEffectif({ variations: [{ options: [{ price: 6000 }, { price: 4500 }] }] })).toBe(4500);
    expect(prixEffectif({})).toBe(null);
  });

  it('configEnEuros fait l’aller-retour exact : coller sa sortie recrée la même config', () => {
    const source = JSON.stringify({
      businessName: 'X', brandColor: '#c9a227',
      categories: [{ name: 'A', services: [
        { name: 'S', price: 45.5, duration: 60,
          variations: [{ name: 'L', options: [{ name: 'c', price: 45.5 }, { name: 'l', price: 60 }] }],
          options: [{ name: 'sup', price: 5, duration: 10 }] },
        { name: 'Sur devis', description: 'Sur devis', duration: 30 },
      ] }],
    });
    const r1 = parseDemoConfig(source);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    const r2 = parseDemoConfig(JSON.stringify(configEnEuros(r1.config)));
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(JSON.stringify(r2.config)).toBe(JSON.stringify(r1.config));
  });

  it('brandColor accepte le hex avec ou sans #, refuse le reste', () => {
    const base = { businessName: 'X', categories: [{ name: 'A', services: [{ name: 'S', price: 10 }] }] };
    const avec = parseDemoConfig(JSON.stringify({ ...base, brandColor: '7c3aed' }));
    expect(avec.ok).toBe(true);
    if (avec.ok) expect(avec.config.brandColor).toBe('#7c3aed');
    expect(parseDemoConfig(JSON.stringify({ ...base, brandColor: 'violet' })).ok).toBe(false);
  });
});
