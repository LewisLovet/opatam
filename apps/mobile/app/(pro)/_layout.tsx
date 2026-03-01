/**
 * Pro Layout
 * Layout for provider/professional screens.
 * Includes auth guard, ProviderProvider, RevenueCatProvider,
 * and a SubscriptionGate that shows the paywall when trial is expired.
 */

import React, { ReactNode } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';
import { useAuth, ProviderProvider, RevenueCatProvider, useProvider } from '../../contexts';
import PaywallScreen from './paywall';

/**
 * SubscriptionGate
 * Shows the paywall fullscreen if the provider's trial expired and no active subscription.
 * Otherwise renders children (the normal pro stack).
 */
function SubscriptionGate({ children }: { children: ReactNode }) {
  const { provider, isLoading } = useProvider();

  // Still loading — don't flash the paywall
  if (isLoading || !provider) return <>{children}</>;

  const { plan, subscription } = provider;

  // Active subscription → allow through
  if (subscription?.status === 'active') return <>{children}</>;

  // Trialing (solo or team with active trial) → allow through
  if ((plan === 'solo' || plan === 'team') && subscription?.status === 'trialing') {
    return <>{children}</>;
  }

  // Trial still valid → allow through
  if (plan === 'trial') {
    const raw = subscription?.validUntil;
    const validDate = raw instanceof Date
      ? raw
      : (raw as any)?.toDate?.()
        || (raw ? new Date(raw as any) : null);
    if (validDate && new Date() <= validDate) {
      return <>{children}</>;
    }
  }

  // Test plan → always allow through
  if (plan === 'test') return <>{children}</>;

  // Subscription expired or no active plan → show paywall
  return <PaywallScreen />;
}

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
        <SubscriptionGate>
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
            <Stack.Screen name="services" options={{ headerShown: false }} />
            <Stack.Screen name="locations" options={{ headerShown: false }} />
            <Stack.Screen name="members" options={{ headerShown: false }} />
            <Stack.Screen name="availability" options={{ headerShown: false }} />
            <Stack.Screen name="profile" options={{ headerShown: false }} />
            <Stack.Screen name="booking-settings" options={{ headerShown: false }} />
            <Stack.Screen name="reviews" options={{ headerShown: false }} />
          </Stack>
        </SubscriptionGate>
      </RevenueCatProvider>
    </ProviderProvider>
  );
}
