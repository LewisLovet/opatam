import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StripeProvider } from '@stripe/stripe-react-native';
import { ThemeProvider } from '../theme';
import {
  ToastProvider,
  NotificationInitializer,
  LocationInitializer,
  MetaAuthSync,
  TrackingInitializer,
} from '../components';
import { DevFAB } from '../components/DevFAB';
import { ProvidersCacheProvider, AuthProvider } from '../contexts';
import { useAppReady, useDeepLinks } from '../hooks';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
// Same merchant ID configured in app.json under the @stripe/stripe-react-native plugin.
// Required for the Apple Pay button in PaymentSheet to render on iOS.
const APPLE_PAY_MERCHANT_ID = 'merchant.com.kamerleontech.opatam';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {

  const { isReady, onLayoutRootView } = useAppReady();

  // Handle deep links (universal links)
  useDeepLinks();

  // Don't render anything until ready
  if (!isReady) {
    return null;
  }

  return (
    // SafeAreaProvider is required for useSafeAreaInsets() to return correct
    // values. Expo Router usually injects one but wrapping it explicitly
    // makes it robust across Expo versions and guarantees insets are ready
    // on the very first render (important for Android edge-to-edge + tab bar).
    <SafeAreaProvider>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <StripeProvider
          publishableKey={STRIPE_PUBLISHABLE_KEY}
          merchantIdentifier={APPLE_PAY_MERCHANT_ID}
          urlScheme="opatam"
        >
        <ThemeProvider>
          <AuthProvider>
            <NotificationInitializer />
            {/* Foreground location permission priming. Does NOT
                require auth (the prompt is informational and safe
                to show pre-login), but kept inside AuthProvider for
                rendering order — both initializers stay grouped so
                they show in sequence on a fresh install. */}
            <LocationInitializer />
            {/* Meta SDK Advanced Matching sync — pushes the
                authenticated user's email / UID / name / phone to
                the FB SDK so subsequent app events ship hashed
                Advanced Matching data. Silent, renders nothing. */}
            <MetaAuthSync />
            {/* iOS App Tracking Transparency prompt — fires once
                the user lands on the main app stack (skipped while
                in the auth flow to avoid interrupting onboarding).
                On grant, enables IDFA tracking on the FB SDK. */}
            <TrackingInitializer />
            <ProvidersCacheProvider>
              <ToastProvider>
                <StatusBar style="auto" />
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(client)" options={{ headerShown: false }} />
                  <Stack.Screen name="(pro)" options={{ headerShown: false }} />
                  <Stack.Screen
                    name="design-system"
                    options={{
                      title: 'Design System',
                      headerShown: true,
                    }}
                  />
                  <Stack.Screen
                    name="business-components"
                    options={{
                      title: 'Composants Métier',
                      headerShown: true,
                    }}
                  />
                </Stack>
                {/* DevFAB — visible uniquement en __DEV__ (gated
                    inside the component). Donne accès au design
                    system, à la config thème et aux resets de
                    storage @opatam/*. Aucun rendu en build prod. */}
                <DevFAB />
              </ToastProvider>
            </ProvidersCacheProvider>
          </AuthProvider>
        </ThemeProvider>
        </StripeProvider>
      </View>
    </SafeAreaProvider>
  );
}
