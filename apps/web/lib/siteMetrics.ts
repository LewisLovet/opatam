/**
 * Mesure d'audience du SITE — celle qui ne concerne aucun prestataire.
 *
 * La chaîne existante (`/api/analytics/track-view` → `pageViewsDaily`) est
 * indexée par `providerId`. La page d'accueil n'en a pas. Lui inventer un
 * identifiant réservé polluerait toutes les requêtes prestataires, qui
 * devraient l'exclure partout et l'oublieraient un jour. D'où une collection
 * distincte, de même forme.
 *
 * UN SEUL FORMAT pour les trois choses qu'on veut savoir — combien de
 * visiteurs, combien cliquent pour télécharger, combien s'inscrivent — parce
 * que la question intéressante est le RAPPORT entre elles, et qu'on ne
 * rapporte bien que des grandeurs comparables.
 *
 * AGRÉGATS SEULEMENT, jamais de visiteur suivi. On ne saura donc pas si CE
 * visiteur-là s'est inscrit, seulement combien de visites et combien
 * d'inscriptions le même jour. C'est moins précis qu'une attribution, et
 * c'est délibéré : une attribution demanderait un cookie, donc un
 * consentement, donc une mesure qui disparaît dès qu'on le refuse — et une
 * moitié de vérité qui se présente comme une vérité entière.
 */

/**
 * Les clés admises. Une liste FERMÉE : le point d'entrée est public, et sans
 * elle n'importe qui pourrait créer des documents à volonté.
 */
export const SITE_METRIC_KEYS = [
  /** Une vue de la page d'accueil. */
  'view:home',
  /** Un clic sur le badge App Store. Un clic n'est pas une installation. */
  'download:ios',
  /** Un clic sur le badge Google Play. */
  'download:android',
  /*
   * Pas de clé pour les inscriptions : elles se comptent depuis la
   * collection `providers`, par date de création. Les instrumenter en
   * doublerait la source de vérité, et priverait la mesure de tout
   * l'historique déjà en base — qu'un compteur, lui, ne pourrait
   * commencer qu'aujourd'hui.
   */
] as const;

export type SiteMetricKey = (typeof SITE_METRIC_KEYS)[number];

export function isSiteMetricKey(v: unknown): v is SiteMetricKey {
  return typeof v === 'string' && (SITE_METRIC_KEYS as readonly string[]).includes(v);
}

/** `YYYY-MM-DD` en heure de Paris — le fuseau de référence du produit. */
export function metricDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Un document par jour ET par clé : `2026-08-20__view:home`. */
export function metricDocId(key: SiteMetricKey, day: string = metricDay()): string {
  return `${day}__${key}`;
}
