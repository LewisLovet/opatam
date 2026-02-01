import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ThemeProvider } from '../theme';
import { ToastProvider, NotificationInitializer } from '../components';
import { ProvidersCacheProvider, AuthProvider } from '../contexts';
import { useAppReady } from '../hooks';

// Prevent splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { isReady, onLayoutRootView } = useAppReady();

  // Don't render anything until ready
  if (!isReady) {
    return null;
  }

  return (
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
  );
}
