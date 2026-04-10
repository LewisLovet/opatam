/**
 * useDeepLinks Hook
 * Handles incoming universal links and redirects to the correct screen.
 *
 * URL mapping:
 *   opatam.com/p/{slug}                    → /(client)/provider/{slug}
 *   opatam.com/avis/{bookingId}            → /(client)/review/{bookingId}
 *   opatam.com/reservation/confirmation/{id} → /(client)/booking-detail/{id}
 */

import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

export function useDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    // Handle URL that opened the app
    const handleURL = (url: string) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;

        // /p/{slug} → provider page
        const providerMatch = path.match(/^\/p\/([^/]+)$/);
        if (providerMatch) {
          router.push(`/(client)/provider/${providerMatch[1]}`);
          return;
        }

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
      } catch {
        // Invalid URL, ignore
      }
    };

    // Check if app was opened from a URL
    Linking.getInitialURL().then((url) => {
      if (url) handleURL(url);
    });

    // Listen for URLs while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleURL(event.url);
    });

    return () => subscription.remove();
  }, [router]);
}
