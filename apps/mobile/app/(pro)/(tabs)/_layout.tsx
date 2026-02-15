/**
 * Pro Tab Navigator
 * Bottom tab navigation for provider/professional screens
 */

import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../../theme';

export default function ProTabsLayout() {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.xs,
          height: 85,
          overflow: 'visible',
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
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={[styles.createButton, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.createButtonInner,
                  {
                    backgroundColor: colors.primary,
                    ...Platform.select({
                      ios: {
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                      },
                      android: {
                        elevation: 6,
                      },
                    }),
                  },
                ]}
              >
                <Ionicons name="add" size={28} color={colors.textInverse} />
              </View>
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e: any) => {
            e.preventDefault();
            router.push('/(pro)/create-booking');
          },
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'RDV',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
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

const styles = StyleSheet.create({
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  createButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
