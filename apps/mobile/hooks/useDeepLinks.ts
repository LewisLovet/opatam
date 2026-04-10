/**
 * useDeepLinks Hook
 * Handles incoming universal links and redirects to the correct screen.
 * Only handles notification-related links (reviews, booking confirmations).
 * Provider pages (/p/*) are NOT intercepted — they stay in the browser.
 *
 * URL mapping:
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
