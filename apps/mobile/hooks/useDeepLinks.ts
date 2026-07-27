/**
 * useDeepLinks — ouvre l'écran correspondant à un lien opatam.com.
 *
 * Correspondances :
 *   opatam.com/p/{slug}                      → /(client)/provider/{slug}
 *   opatam.com/fidelite                      → /(client)/loyalty
 *   opatam.com/avis/{bookingId}              → /(client)/review/{bookingId}
 *   opatam.com/reservation/confirmation/{id} → /(client)/booking-detail/{id}
 * (les préfixes de langue /en /it /pt sont acceptés sur les surfaces
 * publiques traduites)
 *
 * Deux chemins d'entrée : l'URL de lancement (app fermée) et les URL
 * reçues app ouverte. Au lancement, la navigation n'est pas encore prête —
 * l'URL est mise en attente puis rejouée. Les deux chemins passent par LA
 * MÊME fonction `route()` : une version antérieure dupliquait la logique,
 * et la copie du chemin « en attente » — le plus fréquent au démarrage à
 * froid — ne connaissait que les avis et les confirmations. Un lien de
 * prestataire y était silencieusement ignoré.
 */

import { useEffect, useRef } from 'react';
import { useRouter, useNavigationContainerRef } from 'expo-router';
import * as Linking from 'expo-linking';
import { markDeepLinkHandled } from '../lib/pendingRoute';

/** Préfixe de langue optionnel sur les surfaces publiques traduites. */
const L = '(?:/(?:en|it|pt))?';

export function useDeepLinks() {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const pendingUrl = useRef<string | null>(null);

  useEffect(() => {
    /** Aiguille une URL vers l'écran correspondant. Sans correspondance,
     *  on ne fait rien : l'app s'ouvre normalement. */
    const route = (url: string) => {
      try {
        const path = new URL(url).pathname;

        const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
          // Tous les écrans client exigent un compte (garde dans
          // `(client)/_layout`) : la destination est mise de côté et
          // rejouée après connexion.
          [new RegExp(`^${L}/p/([^/]+)$`), (m) => `/(client)/provider/${m[1]}`],
          [new RegExp(`^${L}/fidelite$`), () => '/(client)/loyalty'],
          [/^\/avis\/([^/]+)$/, (m) => `/(client)/review/${m[1]}`],
          [
            /^\/reservation\/confirmation\/([^/]+)$/,
            (m) => `/(client)/booking-detail/${m[1]}`,
          ],
        ];

        for (const [pattern, target] of rules) {
          const match = path.match(pattern);
          if (match) {
            // Empêche `app/index.tsx` de rediriger un visiteur déconnecté
            // vers la connexion et d'éjecter l'écran demandé.
            markDeepLinkHandled();
            router.push(target(match) as never);
            return;
          }
        }
      } catch {
        // URL invalide → on ignore.
      }
    };

    const tryRoute = (url: string) => {
      if (navigationRef.isReady()) {
        route(url);
      } else {
        pendingUrl.current = url;
      }
    };

    // URL de lancement (app fermée) — cas du clic depuis un email/message.
    Linking.getInitialURL().then((url) => {
      if (url) tryRoute(url);
    });

    // URL reçues app déjà ouverte.
    const subscription = Linking.addEventListener('url', (event) => {
      tryRoute(event.url);
    });

    // Rejoue l'URL mise en attente dès que la navigation est prête. Le
    // minuteur ne sert QU'au démarrage (app ouverte, `isReady()` est vrai
    // et `tryRoute` route directement) : on l'arrête dès qu'il a servi
    // plutôt que de le laisser tourner pour rien.
    const interval = setInterval(() => {
      if (!navigationRef.isReady()) return;
      const url = pendingUrl.current;
      pendingUrl.current = null;
      clearInterval(interval);
      if (url) route(url);
    }, 100);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [router, navigationRef]);
}
