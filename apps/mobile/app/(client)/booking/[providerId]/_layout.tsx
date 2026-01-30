/**
 * Booking Flow Layout
 * Wraps booking screens with BookingProvider for shared state
 */

import { Stack } from 'expo-router';
import { BookingProvider } from '../../../../contexts';
import { useTheme } from '../../../../theme';

export default function BookingLayout() {
  const { colors } = useTheme();

  return (
    <BookingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="date" />
        <Stack.Screen name="confirm" />
      </Stack>
    </BookingProvider>
  );
}
