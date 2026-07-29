/**
 * App Entry Point
 * Redirects to the appropriate interface based on auth, role and onboarding state
 */

import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts';
import { AppBootSplash } from '../components/AppBootSplash';
import { hasSeenOnboarding } from '../utils';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading, userData } = useAuth();

  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  // Check onboarding state on mount
  useEffect(() => {
    hasSeenOnboarding().then(setOnboardingSeen);
  }, []);

  // Show loading while checking auth or onboarding state
  // Also wait for userData to be loaded to check role
  //
  // Le décor du splash plutôt qu'un spinner nu : cet instant arrive JUSTE
  // après le splash natif plein écran, et un indicateur seul sur fond
  // clair y produisait une rupture brutale. On prolonge la même scène,
  // le démarrage se lit comme une séquence continue.
  if (authLoading || onboardingSeen === null || (isAuthenticated && !userData)) {
    return <AppBootSplash />;
  }

  // Authenticated → redirect based on role.
  // Roles are exclusive: 'client', 'provider', or 'affiliate'.
  // - 'provider' → pro interface
  // - 'client' → client interface
  // - 'affiliate' → client interface too (the affiliate dashboard lives
  //   on the web for now; the mobile app lets them browse as a guest-like
  //   client until they upgrade their role by registering).
  if (isAuthenticated && userData) {
    if (userData.role === 'provider') {
      return <Redirect href={'/(pro)' as never} />;
    }
    return <Redirect href="/(client)/(tabs)" />;
  }

  // First launch → show onboarding
  if (!onboardingSeen) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // Not authenticated, has seen onboarding → welcome gate
  return <Redirect href="/(auth)" />;
}
