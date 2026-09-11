/**
 * Textes de CHOIX d'une prestation (variations, valeurs, options, champs),
 * à plat et dans un ordre stable — copie JavaScript de
 * `packages/shared/src/utils/service-i18n.ts` (`listChoiceTexts`,
 * `serviceChoicesSourceText`), parce que les scripts ne lisent pas le
 * TypeScript du monorepo.
 *
 * DOIT RESTER IDENTIQUE à la version partagée : le test
 * service-i18n.test.ts compare les deux sorties sur une prestation témoin.
 * Une divergence rendrait toutes les traductions de choix « périmées ».
 */
import { createHash } from 'crypto';

export function listChoiceTexts(service) {
  const out = [];
  const pushVariation = (v, parentId) => {
    out.push({ kind: 'variation', id: v.id, parentId, name: v.name ?? '', description: v.description ?? '' });
    for (const o of v.options ?? []) {
      out.push({ kind: 'variationOption', id: o.id, parentId: v.id, name: o.name ?? '', description: o.description ?? '' });
    }
  };
  const pushField = (f, parentId) => {
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

export function hasChoiceTexts(service) {
  return listChoiceTexts(service).some((t) => t.name || t.description || (t.values?.length ?? 0) > 0);
}

export function serviceChoicesSourceText(service) {
  return listChoiceTexts(service)
    .map((t) => [t.kind, t.parentId ?? '', t.id, t.name, t.description, ...(t.values ?? [])].join('\u0000'))
    .join('\u0000\u0000');
}

/** L'empreinte stockée dans `i18n.choicesHash` et `entries.*.choicesHash`. */
export function choicesHash(service) {
  return createHash('sha1').update(serviceChoicesSourceText(service)).digest('hex');
}

/** Empreinte du nom d'une catégorie créée par le pro. */
export function categoryHash(name) {
  return createHash('sha1').update(name ?? '').digest('hex');
}
