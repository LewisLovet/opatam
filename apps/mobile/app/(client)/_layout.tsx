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
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="edit-profile"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="booking/[providerId]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="booking-detail/[bookingId]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}
