import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../theme';
import { ToastProvider, NotificationInitializer } from '../components';
import { ProvidersCacheProvider, AuthProvider } from '../contexts';
import { useAppReady, useDeepLinks } from '../hooks';

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
        <ThemeProvider>
          <AuthProvider>
            <NotificationInitializer />
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
                {/* DevFAB désactivé pour l'instant */}
                {/* <DevFAB /> */}
              </ToastProvider>
            </ProvidersCacheProvider>
          </AuthProvider>
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}
