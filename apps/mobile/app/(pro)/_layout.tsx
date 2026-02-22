/**
 * Pro Layout
 * Layout for provider/professional screens
 * Includes auth guard, ProviderProvider for provider data,
 * and subscription check (redirects expired users to web).
 */

import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme';
import { useAuth, ProviderProvider, useProvider } from '../../contexts';
import { WebRedirectModal } from '../../components/WebRedirectModal';

export default function ProLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  // If not authenticated → redirect to auth flow
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <ProviderProvider>
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
        </Stack>
      </SubscriptionGate>
    </ProviderProvider>
  );
}

/**
 * SubscriptionGate
 * Shows WebRedirectModal when provider subscription is expired/cancelled.
 * Must be rendered inside ProviderProvider to access useProvider().
 */
function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { provider, isLoading } = useProvider();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (isLoading || !provider) return;

    const { plan, subscription } = provider;

    // Convert validUntil (can be Date, Firestore Timestamp, or string)
    const validUntilRaw = subscription?.validUntil;
    const validDate = validUntilRaw instanceof Date
      ? validUntilRaw
      : (validUntilRaw as any)?.toDate?.()
        || (validUntilRaw ? new Date(validUntilRaw as any) : null);

    // Check if subscription is blocked
    const isTrialExpired =
      plan === 'trial' &&
      validDate &&
      new Date() > validDate;

    const isCancelled = subscription?.status === 'cancelled';
    const isIncomplete = subscription?.status === 'incomplete';

    if (isTrialExpired || isCancelled || isIncomplete) {
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  }, [provider, isLoading]);

  // Always render children; overlay the modal on top when blocked
  return (
    <View style={styles.flex}>
      {children}
      {showModal && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <WebRedirectModal visible={true} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
