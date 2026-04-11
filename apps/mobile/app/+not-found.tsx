/**
 * Catch-all for unmatched routes.
 * Redirects to the appropriate screen based on auth state:
 *   - Authenticated provider → /(pro)
 *   - Authenticated client → /(client)/(tabs)
 *   - Not authenticated → /(auth)
 */

import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts';

export default function NotFoundScreen() {
  const router = useRouter();
  const { isAuthenticated, userData, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && userData) {
      if (userData.role === 'provider') {
        router.replace('/(pro)');
      } else {
        router.replace('/(client)/(tabs)');
      }
    } else {
      router.replace('/(auth)');
    }
  }, [isLoading, isAuthenticated, userData, router]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}
