/**
 * Tab Navigator Layout
 * Bottom tab navigation for client screens
 */

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { useAuth } from '../../../contexts';
import { useClientBookingBadges } from '../../../hooks';

export default function TabsLayout() {
  const { colors, spacing } = useTheme();
  const { user } = useAuth();
  const { upcomingCount } = useClientBookingBadges(user?.uid ?? null);
  const insets = useSafeAreaInsets();

  // Base "content" height of the tab bar (icons + labels), plus the bottom
  // safe-area inset so the tab buttons sit above Android's gesture bar and
  // the iPhone home indicator. The tab bar's background stretches down to
  // the screen edge thanks to paddingBottom.
  const tabBarContentHeight = 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarPosition: 'bottom',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.xs,
          paddingBottom: insets.bottom,
          height: tabBarContentHeight + insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Recherche',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Mes RDV',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
          tabBarBadge: upcomingCount > 0 ? upcomingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Plus',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="ellipsis-horizontal" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
