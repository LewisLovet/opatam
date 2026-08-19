/**
 * Le nom d'une cliente, tel qu'on peut le publier.
 *
 * `Review.clientName` est saisi librement et contient très souvent un nom
 * COMPLET — « Khamallah Farah », « Belghazi nehla » relevés en base. Sur une
 * page d'avis c'est acceptable : la cliente l'a écrit en connaissance de
 * cause, et l'audience est celle qui cherchait déjà le salon. Poussé en story
 * à des milliers d'abonnés, ce n'est plus le même consentement.
 *
 * On ne garde donc QUE LE PREMIER MOT. Pas « Prénom I. » : l'ordre des mots
 * n'est pas garanti — « Khamallah Farah » donnerait « Khamallah F. », qui
 * expose le nom de famille en le faisant passer pour un prénom. Le premier
 * mot seul se trompe parfois de mot, jamais de degré d'exposition.
 *
 * La règle vit ici, dans shared, parce qu'elle vaudra aussi le jour où le web
 * produira ces images — et qu'une règle de vie privée réécrite deux fois finit
 * toujours par diverger.
 */
export function publicReviewAuthor(clientName: string | null | undefined): string {
  const premier = (clientName ?? '').trim().split(/\s+/)[0] ?? '';
  if (!premier) return '';
  // Les saisies en capitales ou tout en minuscules sont fréquentes.
  return premier.charAt(0).toLocaleUpperCase() + premier.slice(1);
}
