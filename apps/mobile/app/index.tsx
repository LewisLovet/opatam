/**
 * App Entry Point
 * Redirects to the appropriate interface based on auth, role and onboarding state
 */

import { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts';
import { useTheme } from '../theme';
import { hasSeenOnboarding } from '../utils';
import { didDeepLinkTakeOver } from '../lib/pendingRoute';

export default function Index() {
  const { isAuthenticated, isLoading: authLoading, userData } = useAuth();
  const { colors } = useTheme();

  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  // Check onboarding state on mount
  useEffect(() => {
    hasSeenOnboarding().then(setOnboardingSeen);
  }, []);

  // Show loading while checking auth or onboarding state
  // Also wait for userData to be loaded to check role
  if (authLoading || onboardingSeen === null || (isAuthenticated && !userData)) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Un lien profond a pris la main (page prestataire, carte de fidélité…) :
  // on ne redirige pas, sinon on éjecterait l'utilisateur de la page qu'il
  // a demandée — l'auth se résout après la lecture du lien.
  if (didDeepLinkTakeOver()) {
    return null;
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
