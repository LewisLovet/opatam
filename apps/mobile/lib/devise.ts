/**
 * Devise du prestataire connecte, lisible hors React.
 *
 * Pourquoi un module et pas un contexte : les ecrans pro formatent leurs
 * prix dans des fonctions AU NIVEAU DU MODULE, qui ne peuvent pas appeler
 * de hook. Leur faire recevoir la devise aurait demande de modifier chaque
 * appel — il y en a des dizaines — et il aurait suffi d'en oublier un pour
 * reafficher des euros a un salon suisse.
 *
 * C'est le meme parti pris que `dateLocale()` dans ces ecrans : la langue
 * aussi est lue depuis un module. Et c'est legitime ici, parce que
 * l'application pro ne connait qu'UN prestataire par session.
 *
 * ATTENTION : cote CLIENT (fiche d'un prestataire qu'on consulte), ce
 * n'est PAS la bonne devise. Ces ecrans-la recoivent l'objet et doivent
 * passer `provider.currency` ou `booking.currency`.
 */
import { DEFAULT_CURRENCY } from '@booking-app/shared';

let devise = DEFAULT_CURRENCY;

/** Appele par ProviderContext quand le prestataire connecte est charge. */
export function setDevisePro(code: string | null | undefined): void {
  devise = code || DEFAULT_CURRENCY;
}

/** Devise du prestataire connecte. Euro tant que rien n'est charge. */
export function devisePro(): string {
  return devise;
}
