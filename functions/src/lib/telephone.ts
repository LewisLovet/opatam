/**
 * Le numéro du prestataire, tel qu'un e-mail peut l'APPELER.
 *
 * Les numéros sont saisis à la main dans le profil : « 06.12.34.56.78 »,
 * « +33 6 12 34 56 78 », « 06 12 34 56 78 », parfois avec des parenthèses.
 * Un `href="tel:"` qui recopie la saisie telle quelle n'est pas composé de
 * la même façon par tous les clients de messagerie — et un bouton qui ne
 * compose rien est pire qu'une ligne de texte.
 *
 * Module SANS import : il est chargé tel quel par `node --test`, et les
 * functions ne peuvent de toute façon pas importer `@booking-app/shared`
 * à l'exécution.
 */

/**
 * Le `tel:` d'un numéro affiché : ses chiffres, précédés du `+` seulement
 * s'il ouvre la saisie (l'indicatif international). Rend `''` quand il n'y a
 * aucun chiffre — l'appelant n'affiche alors pas de bouton.
 */
export function telHref(phone: string | null | undefined): string {
  const brut = (phone ?? '').trim();
  const chiffres = brut.replace(/\D/g, '');
  if (!chiffres) return '';
  return `${brut.startsWith('+') ? '+' : ''}${chiffres}`;
}
