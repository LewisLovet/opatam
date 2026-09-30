/**
 * Espace membre — les écrans du groupe (pro) qu'un MEMBRE peut ouvrir.
 *
 * Pur (aucun import React Native) : testé par `espaceMembre.node.test.mjs`.
 * Tout ce qui n'est pas ici — abonnement, paiements, prestations, équipe,
 * lieux, réglages et statistiques du salon, messagerie Opatam — ramène le
 * membre à son agenda (voir `GardeEspaceMembre`).
 */
export const ECRANS_MEMBRE: ReadonlySet<string> = new Set([
  'index',
  'calendar',
  'bookings',
  'create',
  'more',
  'booking-detail',
  'create-booking',
  'block-slot',
  'blocked-slots',
  'create-activity',
  'availability',
  'planning-horaires',
  'membre-profil',
  'mes-clientes',
  'mon-activite',
]);

/**
 * L'écran visé : le segment après « (pro) » et, s'il y en a, « (tabs) ».
 * L'onglet d'accueil n'a pas de segment à lui : `(pro)/(tabs)` seul = 'index'.
 */
export function ecranDuChemin(segments: readonly string[]): string | null {
  const reste = segments.filter((s) => s !== '(pro)' && s !== '(tabs)');
  return reste[0] ?? (segments.includes('(tabs)') ? 'index' : null);
}

export function estOuvertAuMembre(segments: readonly string[]): boolean {
  const ecran = ecranDuChemin(segments);
  return ecran !== null && ECRANS_MEMBRE.has(ecran);
}
