/**
 * Pro Layout
 * Layout for provider/professional screens
 * Includes auth guard that redirects unauthenticated users to login
 */

import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../theme';
import { useAuth } from '../../contexts';

export default function ProLayout() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  // If not authenticated → redirect to auth flow
  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/(auth)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
