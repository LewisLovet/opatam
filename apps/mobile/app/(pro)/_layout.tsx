/**
 * Pro Layout
 * Layout for provider/professional screens
 * Includes auth guard and ProviderProvider for provider data
 */

import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';
import { useAuth, ProviderProvider } from '../../contexts';

export default function ProLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  // If not authenticated → redirect to auth flow
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <ProviderProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="booking-detail/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="create-booking" options={{ headerShown: false }} />
        <Stack.Screen name="block-slot" options={{ headerShown: false }} />
        <Stack.Screen name="blocked-slots" options={{ headerShown: false }} />
        <Stack.Screen name="stats" options={{ headerShown: false }} />
        <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
      </Stack>
    </ProviderProvider>
  );
}
