import { describe, expect, it } from 'vitest';
import {
  getServiceCategoryText,
  localizeBooleanAnswer,
  listChoiceTexts,
  localizeService,
  localizeServiceChoices,
  serviceChoicesSourceText,
} from './service-i18n';
import { buildBookingSelections, emptyServiceSelections } from './service-pricing';
import type { Service, ServiceTranslations } from '../types';
// La copie JavaScript utilisée par les scripts de traduction — doit produire la même chaîne.
import { serviceChoicesSourceText as scriptChoicesSourceText } from '../../../../scripts/lib/choice-texts.mjs';

/** Une prestation avec les trois sortes de choix, dont des imbriqués. */
const base = {
  name: 'Tresses',
  description: 'Venir démêlée',
  variations: [
    {
      id: 'v1',
      name: 'Longueur',
      description: null,
      options: [
        { id: 'v1a', name: 'Court', description: null, price: 0, duration: 0 },
        { id: 'v1b', name: 'Long', description: 'Sous les épaules', price: 1000, duration: 30 },
      ],
    },
  ],
  options: [
    {
      id: 'o1',
      name: 'Mèches incluses',
      description: null,
      price: 1500,
      duration: 15,
      nestedVariations: [
        { id: 'nv1', name: 'Couleur', description: null, options: [{ id: 'nv1a', name: 'Noir', description: null, price: 0, duration: 0 }] },
      ],
      nestedInfoFields: [
        { id: 'nf1', name: 'Marque souhaitée', description: null, type: 'text' as const, required: false },
      ],
    },
  ],
  infoFields: [
    { id: 'f1', name: 'Texture', description: 'Pour préparer', type: 'select' as const, values: ['Lisse', 'Bouclée'], required: true },
    { id: 'f2', name: 'Allergies', description: null, type: 'text' as const, required: false },
    { id: 'f3', name: 'Première visite ?', description: null, type: 'boolean' as const, required: false },
  ],
} satisfies Partial<Service> & Pick<Service, 'name' | 'variations' | 'options' | 'infoFields'>;

const i18n: ServiceTranslations = {
  sourceLocale: 'fr',
  sourceHash: 'x',
  sourceText: { name: 'Tresses', description: 'Venir démêlée' },
  model: 'test',
  translatedAt: new Date(),
  confidence: 1,
  keptTerms: [],
  entries: {
    en: {
      name: 'Braids',
      description: 'Come detangled',
      choices: {
        variations: {
          v1: { name: 'Length', options: { v1a: { name: 'Short' }, v1b: { name: 'Long', description: 'Below the shoulders' } } },
          nv1: { name: 'Colour', options: { nv1a: { name: 'Black' } } },
        },
        options: { o1: { name: 'Extensions included' } },
        infoFields: {
          f1: { name: 'Texture', description: 'To prepare', values: ['Straight', 'Curly'], sourceValues: ['Lisse', 'Bouclée'] },
          nf1: { name: 'Preferred brand' },
          f3: { name: 'First visit?' },
        },
      },
    },
    it: { name: 'Trecce', description: '' }, // pas de choix traduits en italien
  },
};

const service = { ...base, i18n };

describe('listChoiceTexts / serviceChoicesSourceText', () => {
  it('parcourt les choix de premier niveau ET imbriqués, à plat', () => {
    const kinds = listChoiceTexts(base).map((t) => `${t.kind}:${t.id}`);
    expect(kinds).toEqual([
      'variation:v1', 'variationOption:v1a', 'variationOption:v1b',
      'option:o1', 'variation:nv1', 'variationOption:nv1a', 'infoField:nf1',
      'infoField:f1', 'infoField:f2', 'infoField:f3',
    ]);
  });
  it('change quand une valeur de liste est réordonnée', () => {
    const swapped = { ...base, infoFields: [{ ...base.infoFields[0], values: ['Bouclée', 'Lisse'] }, base.infoFields[1]] };
    expect(serviceChoicesSourceText(swapped)).not.toBe(serviceChoicesSourceText(base));
  });
  it('donne la même chaîne que la copie JavaScript des scripts', () => {
    expect(scriptChoicesSourceText(base)).toBe(serviceChoicesSourceText(base));
  });
  it('est stable pour une prestation identique', () => {
    expect(serviceChoicesSourceText(structuredClone(base))).toBe(serviceChoicesSourceText(base));
  });
});

describe('localizeServiceChoices', () => {
  it('traduit tout, imbriqués compris, sans toucher ids, prix, durées ni ordre', () => {
    const en = localizeServiceChoices(service, 'en');
    expect(en.variations[0].name).toBe('Length');
    expect(en.variations[0].options.map((o) => o.name)).toEqual(['Short', 'Long']);
    expect(en.variations[0].options[1].description).toBe('Below the shoulders');
    expect(en.variations[0].options[1]).toMatchObject({ id: 'v1b', price: 1000, duration: 30 });
    expect(en.options[0].name).toBe('Extensions included');
    expect(en.options[0]).toMatchObject({ id: 'o1', price: 1500, duration: 15 });
    expect(en.options[0].nestedVariations[0].name).toBe('Colour');
    expect(en.options[0].nestedVariations[0].options[0].name).toBe('Black');
    expect(en.options[0].nestedInfoFields[0].name).toBe('Preferred brand');
    expect(en.infoFields[0].values).toEqual(['Straight', 'Curly']);
    expect(en.infoFields[0].description).toBe('To prepare');
  });
  it('sert l’original pour la langue source et pour une langue sans traduction', () => {
    expect(localizeServiceChoices(service, 'fr').variations[0].name).toBe('Longueur');
    expect(localizeServiceChoices(service, 'de').options[0].name).toBe('Mèches incluses');
    expect(localizeServiceChoices(service, 'it').infoFields[0].values).toEqual(['Lisse', 'Bouclée']);
    expect(localizeServiceChoices(base, 'en').variations[0].name).toBe('Longueur');
  });
  it('laisse un libellé sans traduction à l’original, champ par champ', () => {
    // f2 (Allergies) n'a pas d'entrée → original ; f1 traduit à côté.
    const en = localizeServiceChoices(service, 'en');
    expect(en.infoFields[1].name).toBe('Allergies');
  });
  it('n’applique PAS les valeurs traduites si la liste d’origine a changé', () => {
    const changed = { ...service, infoFields: [{ ...base.infoFields[0], values: ['Lisse', 'Bouclée', 'Crépue'] }, base.infoFields[1]] };
    const en = localizeServiceChoices(changed, 'en');
    expect(en.infoFields[0].name).toBe('Texture'); // le libellé, lui, reste traduit
    expect(en.infoFields[0].values).toEqual(['Lisse', 'Bouclée', 'Crépue']);
    const reordered = { ...service, infoFields: [{ ...base.infoFields[0], values: ['Bouclée', 'Lisse'] }, base.infoFields[1]] };
    expect(localizeServiceChoices(reordered, 'en').infoFields[0].values).toEqual(['Bouclée', 'Lisse']);
  });
  it('ne mute pas la prestation d’origine', () => {
    const clone = structuredClone(service);
    localizeServiceChoices(service, 'en');
    expect(service).toEqual(clone);
  });
});

describe('localizeService', () => {
  it('traduit nom, description et choix en une fois', () => {
    const en = localizeService(service, 'en');
    expect(en.name).toBe('Braids');
    expect(en.description).toBe('Come detangled');
    expect(en.variations?.[0].name).toBe('Length');
  });
  it('conserve la description originale quand la traduction est vide', () => {
    expect(localizeService(service, 'it').description).toBe('Venir démêlée');
  });
});

describe('buildBookingSelections — doubles libellés', () => {
  const sel = {
    ...emptyServiceSelections(),
    variations: { v1: 'v1b' },
    options: { o1: { nestedVariations: { nv1: 'nv1a' }, infoValues: { nf1: 'Xpression' } } },
    infoValues: { f1: 'Bouclée', f2: 'aucune', f3: 'Oui' },
  };
  it('écrit l’original ET la version localisée quand la cliente lit une autre langue', () => {
    const b = buildBookingSelections(service, sel, { locale: 'en' });
    expect(b.selectedVariations[0]).toMatchObject({
      variationName: 'Longueur', optionName: 'Long', price: 1000,
      localized: { variationName: 'Length', optionName: 'Long' },
    });
    expect(b.selectedOptions[0]).toMatchObject({ optionName: 'Mèches incluses', localized: { optionName: 'Extensions included' } });
    expect(b.selectedOptions[0].nestedVariations[0].localized).toEqual({ variationName: 'Colour', optionName: 'Black' });
    // Réponse de liste : valeur traduite de même rang. Réponse libre : intacte.
    expect(b.selectedInfo.find((i) => i.fieldId === 'f1')).toMatchObject({ value: 'Bouclée', localized: { label: 'Texture', value: 'Curly' } });
    expect(b.selectedInfo.find((i) => i.fieldId === 'f2')).toMatchObject({ value: 'aucune', localized: { label: 'Allergies', value: 'aucune' } });
    expect(b.selectedOptions[0].info?.[0]).toMatchObject({ value: 'Xpression', localized: { label: 'Preferred brand', value: 'Xpression' } });
  });
  it('n’écrit aucun double pour la langue source, sans langue, ou sans traduction', () => {
    expect(buildBookingSelections(service, sel, { locale: 'fr' }).selectedVariations[0].localized).toBeUndefined();
    expect(buildBookingSelections(service, sel).selectedVariations[0].localized).toBeUndefined();
    expect(buildBookingSelections(base, sel, { locale: 'en' }).selectedVariations[0].localized).toBeUndefined();
  });
  it('traduit la réponse Oui/Non d’un champ booléen, valeur stockée intacte', () => {
    const b = buildBookingSelections(service, sel, { locale: 'en' });
    expect(b.selectedInfo.find((i) => i.fieldId === 'f3')).toMatchObject({
      value: 'Oui',
      localized: { label: 'First visit?', value: 'Yes' },
    });
    expect(b.selectedInfoValues.f3).toBe('Oui');
  });
  it('garde prix et durées identiques avec ou sans localisation', () => {
    const a = buildBookingSelections(service, sel);
    const b = buildBookingSelections(service, sel, { locale: 'en' });
    expect(b.selectedVariations.map((v) => [v.price, v.duration])).toEqual(a.selectedVariations.map((v) => [v.price, v.duration]));
    expect(b.selectedInfoValues).toEqual(a.selectedInfoValues);
  });
});

describe('getServiceCategoryText', () => {
  const cat = {
    name: 'Poses complètes',
    i18n: { sourceLocale: 'fr', sourceHash: 'h', sourceText: { name: 'Poses complètes' }, translatedAt: new Date(), entries: { en: { name: 'Full sets' } } },
  };
  it('sert la traduction, sinon l’original', () => {
    expect(getServiceCategoryText(cat, 'en')).toBe('Full sets');
    expect(getServiceCategoryText(cat, 'fr')).toBe('Poses complètes');
    expect(getServiceCategoryText(cat, 'de')).toBe('Poses complètes');
    expect(getServiceCategoryText({ name: 'Épilations' }, 'en')).toBe('Épilations');
  });
});

describe('localizeBooleanAnswer', () => {
  it('traduit Oui/Non dans les cinq langues, et rien d’autre', () => {
    expect(localizeBooleanAnswer('Oui', 'de')).toBe('Ja');
    expect(localizeBooleanAnswer('Non', 'de')).toBe('Nein');
    expect(localizeBooleanAnswer('Oui', 'en')).toBe('Yes');
    expect(localizeBooleanAnswer('Non', 'pt')).toBe('Não');
    expect(localizeBooleanAnswer('Oui', 'it')).toBe('Sì');
    expect(localizeBooleanAnswer('Oui', 'fr')).toBe('Oui');
    // Valeur libre ou langue inconnue : inchangées.
    expect(localizeBooleanAnswer('Peut-être', 'de')).toBe('Peut-être');
    expect(localizeBooleanAnswer('Oui', 'es')).toBe('Oui');
  });
});
