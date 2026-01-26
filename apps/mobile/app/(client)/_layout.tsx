/**
 * Client Layout
 * Main layout for client-facing screens with tab navigation
 */

import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function ClientLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="provider/[slug]"
        options={{
          headerShown: true,
          headerTitle: '',
          headerBackTitle: 'Retour',
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}
