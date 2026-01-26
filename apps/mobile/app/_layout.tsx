import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '../theme';
import { DevFAB, ToastProvider } from '../components';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
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
        <DevFAB />
      </ToastProvider>
    </ThemeProvider>
  );
}
