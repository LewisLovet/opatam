/**
 * Auth Layout
 * Stack navigation for authentication screens
 * Includes auth guard that redirects authenticated users to their appropriate interface
 */

import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../theme';
import { useAuth } from '../../contexts';
import { consumePendingRoute } from '../../lib/pendingRoute';

export default function AuthLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading, userData } = useAuth();

  // If authenticated and userData loaded → redirect out of auth flow
  // This handles the post-login redirect reactively (no race condition)
  if (!isLoading && isAuthenticated && userData) {
    // Un lien profond a pu viser un écran réservé aux comptes : on y
    // retourne au lieu de retomber sur l'accueil.
    const pending = consumePendingRoute();
    if (pending) {
      return <Redirect href={pending as never} />;
    }
    if (userData.role === 'provider') {
      return <Redirect href={'/(pro)' as never} />;
    }
    return <Redirect href="/(client)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="choose-type" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="pro" />
      <Stack.Screen name="client" />
    </Stack>
  );
}
