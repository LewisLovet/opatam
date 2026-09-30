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
  const { isAuthenticated, isLoading, userData, compteMembre } = useAuth();

  // If authenticated and userData loaded → redirect out of auth flow
  // This handles the post-login redirect reactively (no race condition)
  //
  // …et le compte membre lu (`undefined` = pas encore) : sans cette
  // attente, un membre qui venait de se connecter partait côté client.
  if (!isLoading && isAuthenticated && userData && compteMembre !== undefined) {
    // Une destination mise de côté par la garde de l'espace client est
    // rejouée ici, pour atterrir sur l'écran demandé plutôt que sur
    // l'accueil.
    //
    // Elle ne traverse JAMAIS les espaces. Elle est
    // toujours posée par l'espace client (garde de `(client)/_layout`,
    // écran d'avis) et survit à une déconnexion : sans ce filtre, un pro
    // qui se connectait après une session client atterrissait dans
    // l'espace client.
    const isProvider = userData.role === 'provider';
    // Espace membre (Studio) : son accueil, avant toute destination client.
    if (!isProvider && compteMembre) {
      return <Redirect href={'/(pro)/(tabs)' as never} />;
    }
    const pending = consumePendingRoute();
    if (pending && !isProvider && pending.startsWith('/(client)')) {
      return <Redirect href={pending as never} />;
    }
    if (isProvider) {
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
