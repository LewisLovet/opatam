/**
 * Bascule du SDK Stripe natif d'un compte à l'autre.
 *
 * Le tunnel de réservation encaisse en PAIEMENT DIRECT : le PaymentIntent, le
 * Customer et la clé éphémère vivent sur le compte Stripe du prestataire, pas
 * sur celui de la plateforme. Le SDK doit donc savoir pour quel compte il
 * travaille avant d'ouvrir la feuille de paiement, sinon il cherche le
 * PaymentIntent sur la plateforme et ne le trouve pas.
 *
 * POURQUOI PAS LE COMPOSANT. `StripeProvider` accepte bien `stripeAccountId`,
 * mais il est monté à la racine de l'application : le changer par réservation
 * voudrait dire remonter l'arbre en pleine saisie. Or ce composant n'est
 * qu'un `useEffect` qui appelle `initialise` sur le module natif — et le SDK
 * exporte `initStripe`, qui appelle ce MÊME `initialise`. On obtient donc la
 * bascule sans toucher à l'arbre React.
 *
 * TOUJOURS REVENIR. Le réglage est global au module natif : si on le laissait
 * sur le compte d'un salon, l'abonnement Sérénité — qui s'encaisse sur la
 * plateforme — échouerait ensuite. D'où `revenirSurPlateforme`, à appeler dans
 * un `finally`, succès comme échec.
 */
import { initStripe } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY, APPLE_PAY_MERCHANT_ID } from './config';

/** Les mêmes valeurs que `StripeProvider` à la racine, sans le compte. */
const BASE = {
  publishableKey: STRIPE_PUBLISHABLE_KEY,
  merchantIdentifier: APPLE_PAY_MERCHANT_ID,
  urlScheme: 'opatam',
} as const;

/**
 * Bascule le SDK sur le compte connecté d'un prestataire.
 *
 * À appeler juste AVANT `initPaymentSheet`. Les appels au module natif
 * partent sur la même file, donc dans l'ordre d'émission : la feuille est
 * initialisée après la bascule.
 */
export async function basculerSurCompte(accountId: string): Promise<void> {
  await initStripe({ ...BASE, stripeAccountId: accountId });
}

/**
 * Remet le SDK sur le compte de la plateforme.
 *
 * À appeler dans un `finally`. Omettre cet appel laisserait l'application
 * entière en train de parler au compte du dernier salon visité.
 */
export async function revenirSurPlateforme(): Promise<void> {
  await initStripe({ ...BASE });
}
