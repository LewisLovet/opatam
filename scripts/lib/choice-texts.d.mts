/**
 * Déclarations pour `choice-texts.mjs`, à destination du test d'alignement
 * `packages/shared/src/utils/service-i18n.test.ts` : tsc résout ce fichier
 * (une déclaration échappe à la contrainte `rootDir` du paquet shared),
 * esbuild bundle l'implémentation .mjs.
 */
export interface ChoiceText {
  kind: 'variation' | 'variationOption' | 'option' | 'infoField';
  id: string;
  parentId?: string;
  name: string;
  description: string;
  values?: string[];
}
export declare function listChoiceTexts(service: unknown): ChoiceText[];
export declare function hasChoiceTexts(service: unknown): boolean;
export declare function serviceChoicesSourceText(service: unknown): string;
export declare function choicesHash(service: unknown): string;
export declare function categoryHash(name: string | null | undefined): string;
