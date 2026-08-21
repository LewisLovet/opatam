/**
 * Image sociale de la fiche en de — même générateur que `/p/[slug]`.
 *
 * Une image Open Graph est un FICHIER DE ROUTE : contrairement à `default` et
 * `generateMetadata`, elle ne se réexporte pas depuis la page. Sans ce
 * fichier, les quatre fiches traduites annonçaient une grande carte sans
 * image — et retombaient sur le favicon, exactement le défaut qu'on venait
 * de corriger en français.
 *
 * Les métadonnées de segment sont déclarées LOCALEMENT, comme pour la page :
 * l'analyse statique de Next ne les suit pas à travers une réexportation.
 */
export { default } from '../../../p/[slug]/opengraph-image';

export const alt = 'Réserver en ligne';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
