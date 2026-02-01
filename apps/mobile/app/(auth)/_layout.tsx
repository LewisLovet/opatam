/**
 * Auth Layout
 * Stack navigation for authentication screens
 * Includes auth guard that redirects authenticated users to their appropriate interface
 */

import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../theme';
import { useAuth } from '../../contexts';

export default function AuthLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading, userData } = useAuth();

  // If authenticated and userData loaded → redirect out of auth flow
  // This handles the post-login redirect reactively (no race condition)
  if (!isLoading && isAuthenticated && userData) {
    if (userData.role === 'provider') {
      return <Redirect href="/(pro)" />;
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
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="pro" />
      <Stack.Screen name="client" />
    </Stack>
  );
}
