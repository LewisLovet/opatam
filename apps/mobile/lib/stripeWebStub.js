/**
 * Coquille de `@stripe/stripe-react-native` pour l'aperçu web.
 *
 * POURQUOI ELLE EXISTE : `expo start --web` ne démarrait plus du tout. Le
 * layout racine croyait pourtant se protéger —
 *
 *     Platform.OS === 'web' ? passthrough : require('@stripe/stripe-react-native')
 *
 * — mais Metro analyse les `require` STATIQUEMENT : la branche jamais prise à
 * l'exécution est quand même mise dans le paquet, et le module tire des
 * internes de React Native qui n'existent pas sur le web. L'application
 * entière échouait à se construire sur un test qui semblait la protéger.
 *
 * L'aiguillage se fait donc à la RÉSOLUTION (voir `metro.config.js`), seul
 * moment où la plateforme est connue avant l'analyse des imports.
 *
 * Le paiement reste natif : cette coquille sert à ce que les écrans SANS
 * paiement soient consultables dans le navigateur, pas à faire marcher Stripe
 * sur le web. D'où des fonctions qui échouent bruyamment plutôt que de faire
 * semblant de réussir.
 */

const indisponible = () =>
  Promise.resolve({
    error: {
      code: 'Failed',
      message: "Le paiement n'est pas disponible dans l'aperçu web.",
    },
  });

export function useStripe() {
  return {
    initPaymentSheet: indisponible,
    presentPaymentSheet: indisponible,
    confirmPayment: indisponible,
    createPaymentMethod: indisponible,
    handleNextAction: indisponible,
  };
}

/** Rend ses enfants tels quels : aucun contexte natif à fournir. */
export function StripeProvider({ children }) {
  return children;
}

export default { useStripe, StripeProvider };
