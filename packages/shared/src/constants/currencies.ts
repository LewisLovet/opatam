/**
 * Devises — LA source unique.
 *
 * Trois « devises » se confondent facilement et ce fichier n'en couvre
 * qu'UNE : celle du prestataire, dans laquelle il affiche ses prix ET
 * encaisse. Les deux autres sont ailleurs et ne se règlent pas ici :
 *
 *  - la devise de VERSEMENT sur son compte bancaire découle du pays de son
 *    compte Stripe Connect et de son IBAN, jamais d'un réglage ;
 *  - une conversion à l'affichage pour une cliente d'un autre pays
 *    demanderait une source de taux et l'obligation de montrer la devise
 *    réellement débitée au paiement. Volontairement hors sujet ici.
 *
 * PÉRIMÈTRE — une devise n'est listée ici que si Stripe opère dans le pays
 * qui l'émet, parce qu'un prestataire sans compte Connect ne peut pas
 * encaisser d'acompte. Le dirham marocain a été retiré le 2026-09-27 pour
 * cette raison : le Maroc n'est pas un pays Stripe (stripe.com/global), donc
 * un prestataire marocain n'aurait jamais pu recevoir de virement. Afficher
 * une devise qu'on ne peut pas encaisser est pire que de ne pas l'offrir.
 *
 * `decimals` n'est pas décoratif. Tout le code stocke des montants en
 * unités MINEURES (centimes) et divise par 100 ; une devise sans décimale
 * comme le franc CFA casserait chaque prix affiché et chaque saisie. Les
 * devises listées ici ont donc toutes deux décimales. En ajouter une à
 * zéro décimale demande d'abord de rendre les champs de saisie et les
 * divisions par 100 dépendants de `decimals` — ce n'est pas qu'une ligne
 * dans ce tableau.
 */

export interface Devise {
  code: string;
  /** Nom affiché dans le sélecteur. */
  label: string;
  /** Symbole court, pour les endroits trop étroits pour un montant formaté. */
  symbol: string;
  /** Unités mineures par unité : 2 pour l'euro (centimes), 0 pour le franc CFA. */
  decimals: number;
}

export const SUPPORTED_CURRENCIES: readonly Devise[] = [
  { code: 'EUR', label: 'Euro', symbol: '€', decimals: 2 },
  { code: 'CHF', label: 'Franc suisse', symbol: 'CHF', decimals: 2 },
  { code: 'GBP', label: 'Livre sterling', symbol: '£', decimals: 2 },
  { code: 'USD', label: 'Dollar américain', symbol: '$', decimals: 2 },
  { code: 'CAD', label: 'Dollar canadien', symbol: 'CA$', decimals: 2 },
] as const;

export type CurrencyCode = string;

/** Devise par défaut — celle de la quasi-totalité des comptes existants. */
export const DEFAULT_CURRENCY = 'EUR';

/**
 * Devise proposée par défaut selon le pays.
 *
 * Un pays absent retombe sur l'euro : huit des neuf pays ouverts
 * aujourd'hui sont dans la zone euro, la Suisse est la seule exception.
 */
const DEVISE_PAR_PAYS: Record<string, string> = {
  FR: 'EUR', BE: 'EUR', LU: 'EUR', DE: 'EUR', ES: 'EUR',
  IT: 'EUR', NL: 'EUR', PT: 'EUR', IE: 'EUR', AT: 'EUR',
  FI: 'EUR', GR: 'EUR',
  CH: 'CHF', LI: 'CHF',
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
  // Pas de MA : le Maroc n'est pas un pays Stripe (voir l'en-tete), un
  // compte marocain n'existe pas, donc aucune devise a lui proposer.
};

export function getCurrencyForCountry(countryCode: string | null | undefined): string {
  if (!countryCode) return DEFAULT_CURRENCY;
  return DEVISE_PAR_PAYS[countryCode.toUpperCase()] ?? DEFAULT_CURRENCY;
}

export function getCurrency(code: string | null | undefined): Devise {
  const trouvee = SUPPORTED_CURRENCIES.find(
    (d) => d.code === (code ?? '').toUpperCase(),
  );
  return trouvee ?? SUPPORTED_CURRENCIES[0];
}

export function isSupportedCurrency(code: string | null | undefined): boolean {
  if (!code) return false;
  return SUPPORTED_CURRENCIES.some((d) => d.code === code.toUpperCase());
}

/**
 * Frais de service prélevés à la cliente sur un acompte, PAR DEVISE.
 *
 * Remplace la constante unique de 49 centimes d'euro. Les montants ne sont
 * pas convertis au taux du jour : ce sont des prix ronds, choisis pour
 * rester lisibles et du même ordre de grandeur. `minDeposit` est le seuil
 * sous lequel aucun frais n'est prélevé.
 */
export const SERVICE_FEE_BY_CURRENCY: Record<string, { fee: number; minDeposit: number }> = {
  EUR: { fee: 49, minDeposit: 500 },
  CHF: { fee: 50, minDeposit: 500 },
  GBP: { fee: 45, minDeposit: 500 },
  USD: { fee: 55, minDeposit: 500 },
  CAD: { fee: 75, minDeposit: 700 },
};

/**
 * Le prestataire peut-il encore changer de devise ?
 *
 * La devise se verrouille au PREMIER ENCAISSEMENT, pas à la connexion de
 * Stripe. La nuance n'est pas cosmétique : la quasi-totalité des comptes
 * existants ont déjà branché Stripe, donc verrouiller là-dessus les
 * figerait tous sur l'euro — y compris les prestataires suisses, qui sont
 * la raison d'être de ce réglage.
 *
 * Le verrou est posé par le webhook Stripe quand un acompte passe à
 * « payé ». Les comptes d'avant cette fonctionnalité n'ont pas le champ :
 * ils gardent donc un choix libre jusqu'à leur prochain encaissement.
 * C'est voulu.
 *
 * Ce n'est PAS une frontière de sécurité, seulement la règle métier. La
 * garde qui compte est côté serveur (route de mise à jour du prestataire)
 * et dans les règles Firestore.
 */
export function peutChangerDevise(
  provider: { currencyLockedAt?: unknown } | null | undefined,
): boolean {
  return !provider?.currencyLockedAt;
}

/**
 * Pourquoi la devise est figée, pour l'expliquer à l'écran.
 * `null` quand elle est encore libre.
 */
export function raisonVerrouDevise(
  provider: { currencyLockedAt?: unknown } | null | undefined,
): 'paiement_encaisse' | null {
  return provider?.currencyLockedAt ? 'paiement_encaisse' : null;
}
