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

/**
 * Longueur maximale d'une citation en story.
 *
 * Un avis peut faire 1 000 caractères — 2 000 pour un avis importé. Rien ne
 * bornait la citation : elle étirait la carte, repoussait l'appel à l'action
 * hors de l'image, ou se faisait couper au découpage 1080×1920. Un avis long
 * ne se lit de toute façon pas sur une story qu'on fait défiler en deux
 * secondes.
 */
export const STORY_EXCERPT_MAX = 260;

/**
 * L'extrait publiable d'un commentaire. L'avis d'origine n'est JAMAIS
 * modifié : c'est la parole d'une cliente, on n'y touche pas en base.
 *
 * La coupe se fait sur un blanc, pas au milieu d'un mot, et la ponctuation
 * traînante est retirée avant les points de suspension — « chaleureux, … »
 * se lit comme une faute.
 */
export function storyReviewExcerpt(
  comment: string | null | undefined,
  max: number = STORY_EXCERPT_MAX
): string | null {
  const t = (comment ?? '').trim();
  if (!t) return null;
  if (t.length <= max) return t;

  const coupe = t.slice(0, max);
  const dernierBlanc = coupe.lastIndexOf(' ');
  // Un mot unique plus long que la limite n'a pas de blanc où couper : on
  // tronque alors franchement plutôt que de tout jeter.
  const base = dernierBlanc > max * 0.6 ? coupe.slice(0, dernierBlanc) : coupe;
  return base.replace(/[\s,;:.!?…-]+$/u, '') + '…';
}
