import { describe, it, expect } from 'vitest';
import { themeDepuisCouleur, nomDuTheme } from './sales-demo-theme';

/**
 * La correspondance couleur → thème est ce que le prospect verra en premier :
 * chaque cas ancre une famille. Les attendus sont des FAMILLES de teintes
 * (plusieurs violets existent) — on vérifie que la teinte tombe du bon côté,
 * pas un id figé qui casserait à chaque retouche du catalogue.
 */
describe('themeDepuisCouleur', () => {
  const violets = ['prune', 'lavande', 'fuchsia'];
  const rouges = ['rouge', 'bordeaux', 'framboise', 'corail'];
  const bleus = ['bleu', 'marine', 'ocean'];
  const verts = ['emeraude', 'foret', 'sauge'];
  const neutres = ['noir', 'anthracite', 'ardoise', 'taupe', 'nude'];

  it('un violet reste un violet', () => {
    expect(violets).toContain(themeDepuisCouleur('#7c3aed'));
    expect(violets).toContain(themeDepuisCouleur('#a855f7'));
  });

  it('un rouge/bordeaux tombe côté rouges', () => {
    expect(rouges).toContain(themeDepuisCouleur('#b91c1c'));
    expect(rouges).toContain(themeDepuisCouleur('#7f1d1d'));
  });

  it('un bleu tombe côté bleus', () => {
    expect(bleus).toContain(themeDepuisCouleur('#2563eb'));
    expect(bleus).toContain(themeDepuisCouleur('#0e2a5c'));
  });

  it('un vert tombe côté verts', () => {
    expect(verts).toContain(themeDepuisCouleur('#059669'));
  });

  it('noir et gris vont aux neutres, jamais à une couleur', () => {
    expect(themeDepuisCouleur('#000000')).toBe('noir');
    expect(neutres).toContain(themeDepuisCouleur('#666a70'));
  });

  it("l'or/doré d'un institut tombe côté chauds", () => {
    expect(['or', 'ambre', 'cuivre', 'terracotta']).toContain(themeDepuisCouleur('#c9a227'));
  });

  it('hex invalide → thème par défaut, sans jeter', () => {
    expect(typeof themeDepuisCouleur('pas-une-couleur')).toBe('string');
  });

  it('nomDuTheme rend un libellé lisible', () => {
    expect(nomDuTheme('noir')).toBe('Noir');
  });
});
