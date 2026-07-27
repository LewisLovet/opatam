/**
 * Validation de numéro de téléphone — INTERNATIONALE.
 *
 * Historique : l'inscription client, la fiche profil et les membres d'équipe
 * imposaient `/^0[67]\d{8}$/` (mobile français). Depuis l'ouverture aux
 * marchés européens, un client italien ou portugais se voyait refuser SON
 * propre numéro — alors que la réservation, elle, acceptait déjà les formats
 * internationaux (booking.schema.ts). Ce helper unifie les deux.
 *
 * Règle : 8 à 15 chiffres (norme E.164), un `+` facultatif en tête, et les
 * séparateurs usuels tolérés à la saisie (espaces, points, tirets,
 * parenthèses).
 */

/** Retire les séparateurs de saisie — à appliquer avant stockage. */
export function stripPhoneSeparators(phone: string): string {
  return phone.replace(/[\s.\-()]/g, '');
}

/**
 * Validation SANS pays connu (inscription client, profil, membres d'équipe).
 * Quand le pays EST connu (formulaire de lieu), préférer le validateur
 * par pays `isValidPhone(phone, countryCode)` de location.schema.ts, plus
 * strict.
 */
export function isValidInternationalPhone(phone: string): boolean {
  const cleaned = stripPhoneSeparators(phone);
  if (!/^(\+)?[0-9]+$/.test(cleaned)) return false;
  const digits = cleaned.replace(/\D/g, '').length;
  return digits >= 8 && digits <= 15;
}
