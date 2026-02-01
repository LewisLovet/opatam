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

  // Authenticated → redirect based on role
  if (isAuthenticated && userData) {
    // Providers go to Pro interface, clients go to Client interface
    // 'both' role goes to client by default (can switch later)
    if (userData.role === 'provider') {
      return <Redirect href="/(pro)" />;
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
