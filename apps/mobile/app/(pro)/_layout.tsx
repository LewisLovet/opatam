/**
 * Pro Layout
 * Layout for provider/professional screens.
 * Includes auth guard, ProviderProvider, RevenueCatProvider.
 * No full-screen paywall gate — Apple requires users always have access
 * to account management (delete account, sign out, settings).
 * Instead, subscription status is shown in the "Plus" screen and
 * the paywall is accessible as a regular screen in the stack.
 */

import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';
import { useAuth, ProviderProvider, RevenueCatProvider } from '../../contexts';

export default function ProLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  // If not authenticated → redirect to auth flow
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <ProviderProvider>
      <RevenueCatProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="booking-detail/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="create-booking" options={{ headerShown: false }} />
          <Stack.Screen name="block-slot" options={{ headerShown: false }} />
          <Stack.Screen name="blocked-slots" options={{ headerShown: false }} />
          <Stack.Screen name="stats" options={{ headerShown: false }} />
          <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
          <Stack.Screen name="services" options={{ headerShown: false }} />
          <Stack.Screen name="locations" options={{ headerShown: false }} />
          <Stack.Screen name="members" options={{ headerShown: false }} />
          <Stack.Screen name="availability" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="booking-settings" options={{ headerShown: false }} />
          <Stack.Screen name="reviews" options={{ headerShown: false }} />
        </Stack>
      </RevenueCatProvider>
    </ProviderProvider>
  );
}
