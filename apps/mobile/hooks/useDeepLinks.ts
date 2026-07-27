/**
 * useDeepLinks Hook
 * Handles incoming universal links and redirects to the correct screen.
 * Only handles notification-related links (reviews, booking confirmations).
 * Les pages prestataire (/p/*) ouvrent l'écran presta de l'app : elles ne
 * demandent pas de compte, et le filtre Android les routait déjà ici.
 *
 * URL mapping:
 *   opatam.com/fidelite                    → /(client)/loyalty
 *   opatam.com/p/{slug}                    → /(client)/provider/{slug}
 *   opatam.com/avis/{bookingId}            → /(client)/review/{bookingId}
 *   opatam.com/reservation/confirmation/{id} → /(client)/booking-detail/{id}
 */

import { useEffect, useRef } from 'react';
import { useRouter, useNavigationContainerRef } from 'expo-router';
import * as Linking from 'expo-linking';

export function useDeepLinks() {
  const router = useRouter();
  const navigationRef = useNavigationContainerRef();
  const pendingUrl = useRef<string | null>(null);

  useEffect(() => {
    const handleURL = (url: string) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;

        // /avis/{bookingId} → review page
        const reviewMatch = path.match(/^\/avis\/([^/]+)$/);
        if (reviewMatch) {
          router.push(`/(client)/review/${reviewMatch[1]}`);
          return;
        }

        // /reservation/confirmation/{id} → booking detail
        const confirmMatch = path.match(/^\/reservation\/confirmation\/([^/]+)$/);
        if (confirmMatch) {
          router.push(`/(client)/booking-detail/${confirmMatch[1]}`);
          return;
        }

        // /fidelite → espace fidélité du client (lien « ouvrir ma carte
        // dans l'app » depuis le web). Le guard (auth) redirige vers la
        // connexion si besoin, puis l'écran s'affiche.
        if (/^(?:\/(?:en|it|pt))?\/fidelite$/.test(path)) {
          router.push('/(client)/loyalty');
          return;
        }

        // /p/{slug} → page du prestataire dans l'app. Le filtre Android
        // ouvrait DÉJÀ l'app sur ces liens (autoVerify sur /p/ depuis
        // avril) sans que rien ne les traite : l'utilisateur atterrissait
        // sur l'accueil. L'écran presta ne demande pas de compte.
        const providerMatch = path.match(/^(?:\/(?:en|it|pt))?\/p\/([^/]+)$/);
        if (providerMatch) {
          router.push(`/(client)/provider/${providerMatch[1]}`);
          return;
        }

        // All other URLs (including /p/*) → ignore, app opens normally
      } catch {
        // Invalid URL, ignore
      }
    };

    const tryHandleUrl = (url: string) => {
      // Wait for navigation to be ready before routing
      if (navigationRef.isReady()) {
        handleURL(url);
      } else {
        pendingUrl.current = url;
      }
    };

    // Check if app was opened from a URL
    Linking.getInitialURL().then((url) => {
      if (url) tryHandleUrl(url);
    });

    // Listen for URLs while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      tryHandleUrl(event.url);
    });

    return () => subscription.remove();
  }, [router, navigationRef]);

  // Handle pending URL once navigation is ready
  useEffect(() => {
    if (navigationRef.isReady() && pendingUrl.current) {
      const url = pendingUrl.current;
      pendingUrl.current = null;
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;

        const reviewMatch = path.match(/^\/avis\/([^/]+)$/);
        if (reviewMatch) {
          router.push(`/(client)/review/${reviewMatch[1]}`);
          return;
        }

        const confirmMatch = path.match(/^\/reservation\/confirmation\/([^/]+)$/);
        if (confirmMatch) {
          router.push(`/(client)/booking-detail/${confirmMatch[1]}`);
          return;
        }
      } catch {
        // ignore
      }
    }
  }, [navigationRef.isReady(), router]);
}
