/**
 * Auth Layout
 * Stack navigation for authentication screens
 */

import { Stack } from 'expo-router';
import { useTheme } from '../../theme';

export default function AuthLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="pro" />
      <Stack.Screen name="client" />
    </Stack>
  );
}
