/**
 * Traduction des CHOIX d'une prestation (variations, options, champs
 * d'information) et des catégories créées par le professionnel.
 *
 * Complète `getServiceText` (nom + description). Même contrat :
 *   - une traduction absente n'est pas une panne, l'original s'affiche ;
 *   - la langue source est servie telle quelle ;
 *   - rien d'autre que le texte ne change : ids, prix, durées, ordre et
 *     structure sont conservés à l'identique, ce qui garantit que les
 *     sélections faites sur une prestation localisée restent valides sur
 *     l'originale (même ids).
 *
 * Aucun hachage ici : le navigateur et l'app n'ont pas besoin de crypto.
 * Les scripts de traduction hachent `serviceChoicesSourceText`, une
 * sérialisation canonique que ce fichier définit pour que tout le monde
 * compte les mêmes textes.
 */

import type {
  Service,
  ServiceCategoryTranslations,
  ServiceChoicesTranslation,
  ServiceInfoField,
  ServiceLocale,
  ServiceOption,
  ServiceTranslations,
  ServiceVariation,
  TranslatedLabel,
} from '../types';

type ChoiceSource = Pick<Service, 'variations' | 'options' | 'infoFields'> & {
  i18n?: ServiceTranslations | null;
};

/** Tout ce que les choix d'une prestation contiennent comme texte, à plat. */
export interface ChoiceTextItem {
  kind: 'variation' | 'variationOption' | 'option' | 'infoField';
  id: string;
  /** Pour une valeur de variation : l'id du groupe ; pour un choix imbriqué : l'id de l'option parente. */
  parentId?: string;
  name: string;
  description: string;
  /** Valeurs d'une liste (champ d'information `select`). */
  values?: string[];
}

/** Parcours à plat, dans un ordre stable, de tous les textes de choix. */
export function listChoiceTexts(service: Pick<Service, 'variations' | 'options' | 'infoFields'>): ChoiceTextItem[] {
  const out: ChoiceTextItem[] = [];
  const pushVariation = (v: ServiceVariation, parentId?: string) => {
    out.push({ kind: 'variation', id: v.id, parentId, name: v.name ?? '', description: v.description ?? '' });
    for (const o of v.options ?? []) {
      out.push({ kind: 'variationOption', id: o.id, parentId: v.id, name: o.name ?? '', description: o.description ?? '' });
    }
  };
  const pushField = (f: ServiceInfoField, parentId?: string) => {
    out.push({
      kind: 'infoField',
      id: f.id,
      parentId,
      name: f.name ?? '',
      description: f.description ?? '',
      values: f.type === 'select' ? [...(f.values ?? [])] : undefined,
    });
  };
  for (const v of service.variations ?? []) pushVariation(v);
  for (const o of service.options ?? []) {
    out.push({ kind: 'option', id: o.id, name: o.name ?? '', description: o.description ?? '' });
    for (const v of o.nestedVariations ?? []) pushVariation(v, o.id);
    for (const f of o.nestedInfoFields ?? []) pushField(f, o.id);
  }
  for (const f of service.infoFields ?? []) pushField(f);
  return out;
}

/** Vrai si la prestation porte au moins un texte de choix à traduire. */
export function hasChoiceTexts(service: Pick<Service, 'variations' | 'options' | 'infoFields'>): boolean {
  return listChoiceTexts(service).some((t) => t.name || t.description || (t.values?.length ?? 0) > 0);
}

/**
 * Sérialisation canonique des textes de choix — ce que les scripts hachent
 * (`choicesHash`). Le séparateur nul évite qu'un déplacement de texte entre
 * deux champs produise la même chaîne. Les ids en font partie : une valeur
 * recréée sous un nouvel id est un nouveau texte à traduire.
 */
export function serviceChoicesSourceText(service: Pick<Service, 'variations' | 'options' | 'infoFields'>): string {
  return listChoiceTexts(service)
    .map((t) => [t.kind, t.parentId ?? '', t.id, t.name, t.description, ...(t.values ?? [])].join('\u0000'))
    .join('\u0000\u0000');
}

const sameStrings = (a: readonly string[] | undefined, b: readonly string[] | undefined): boolean =>
  !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

function pick(label: TranslatedLabel | undefined, original: string, key: 'name' | 'description'): string {
  const t = label?.[key];
  return t ? t : original;
}

function localizeVariation(v: ServiceVariation, tr: ServiceChoicesTranslation | undefined): ServiceVariation {
  const tv = tr?.variations?.[v.id];
  return {
    ...v,
    name: pick(tv, v.name, 'name'),
    description: v.description == null && !tv?.description ? v.description : pick(tv, v.description ?? '', 'description'),
    options: (v.options ?? []).map((o) => {
      const to = tv?.options?.[o.id];
      return {
        ...o,
        name: pick(to, o.name, 'name'),
        description: o.description == null && !to?.description ? o.description : pick(to, o.description ?? '', 'description'),
      };
    }),
  };
}

function localizeField(f: ServiceInfoField, tr: ServiceChoicesTranslation | undefined): ServiceInfoField {
  const tf = tr?.infoFields?.[f.id];
  const out: ServiceInfoField = {
    ...f,
    name: pick(tf, f.name, 'name'),
    description: f.description == null && !tf?.description ? f.description : pick(tf, f.description ?? '', 'description'),
  };
  // Les valeurs d'une liste ne sont servies traduites que si le tableau
  // d'origine n'a pas bougé depuis la traduction (même ordre, même contenu).
  if (f.type === 'select' && f.values && tf?.values && sameStrings(tf.sourceValues, f.values) && tf.values.length === f.values.length) {
    out.values = f.values.map((v, i) => tf.values![i] || v);
  }
  return out;
}

/**
 * La traduction des choix à utiliser pour une langue, ou `undefined` quand
 * il faut servir l'original (langue source, ou pas d'entrée).
 */
export function getChoicesTranslation(
  i18n: ServiceTranslations | null | undefined,
  locale: string,
): ServiceChoicesTranslation | undefined {
  if (!i18n || locale === i18n.sourceLocale) return undefined;
  return i18n.entries?.[locale as ServiceLocale]?.choices ?? undefined;
}

/**
 * Les variations, options et champs d'une prestation, dans la langue
 * demandée. Structure, ids, prix et durées inchangés.
 */
export function localizeServiceChoices(
  service: ChoiceSource,
  locale: string,
): { variations: ServiceVariation[]; options: ServiceOption[]; infoFields: ServiceInfoField[] } {
  const tr = getChoicesTranslation(service.i18n, locale);
  const variations = (service.variations ?? []).map((v) => localizeVariation(v, tr));
  const options = (service.options ?? []).map((o) => {
    const to = tr?.options?.[o.id];
    return {
      ...o,
      name: pick(to, o.name, 'name'),
      description: o.description == null && !to?.description ? o.description : pick(to, o.description ?? '', 'description'),
      nestedVariations: (o.nestedVariations ?? []).map((v) => localizeVariation(v, tr)),
      nestedInfoFields: (o.nestedInfoFields ?? []).map((f) => localizeField(f, tr)),
    };
  });
  const infoFields = (service.infoFields ?? []).map((f) => localizeField(f, tr));
  return { variations, options, infoFields };
}

/**
 * La prestation entière telle qu'elle doit s'AFFICHER dans une langue :
 * nom, description et choix traduits, tout le reste intact. À appeler une
 * fois en amont d'un écran, qui rend ensuite la prestation comme d'habitude.
 */
export function localizeService<T extends { name: string; description?: string | null; i18n?: ServiceTranslations | null } & Partial<Pick<Service, 'variations' | 'options' | 'infoFields'>>>(
  service: T,
  locale: string,
): T {
  const i18n = service.i18n;
  let name = service.name;
  let description = service.description;
  if (i18n && locale !== i18n.sourceLocale) {
    const entry = i18n.entries?.[locale as ServiceLocale];
    if (entry) {
      name = entry.name || service.name;
      description = entry.description || service.description;
    }
  }
  const choices = localizeServiceChoices(service as ChoiceSource, locale);
  return {
    ...service,
    name,
    description,
    ...(service.variations !== undefined ? { variations: choices.variations } : {}),
    ...(service.options !== undefined ? { options: choices.options } : {}),
    ...(service.infoFields !== undefined ? { infoFields: choices.infoFields } : {}),
  };
}

/** Le nom d'une catégorie de prestations créée par le pro, dans une langue. */
export function getServiceCategoryText(
  category: { name: string; i18n?: ServiceCategoryTranslations | null },
  locale: string,
): string {
  const i18n = category.i18n;
  if (!i18n || locale === i18n.sourceLocale) return category.name;
  return i18n.entries?.[locale as ServiceLocale]?.name || category.name;
}

/**
 * Réponse d'un champ « oui / non ». La valeur STOCKÉE est toujours
 * 'Oui'/'Non' (contrat de données avec le pro) ; à l'écran et dans le
 * snapshot de réservation, la cliente lit l'équivalent dans sa langue.
 * Toute autre valeur (texte libre, données anciennes) est rendue telle
 * quelle.
 */
const BOOLEAN_ANSWERS: Record<string, { Oui: string; Non: string }> = {
  fr: { Oui: 'Oui', Non: 'Non' },
  en: { Oui: 'Yes', Non: 'No' },
  it: { Oui: 'Sì', Non: 'No' },
  pt: { Oui: 'Sim', Non: 'Não' },
  de: { Oui: 'Ja', Non: 'Nein' },
};

export function localizeBooleanAnswer(value: string, locale: string): string {
  const map = BOOLEAN_ANSWERS[locale];
  if (!map) return value;
  return value === 'Oui' ? map.Oui : value === 'Non' ? map.Non : value;
}
