/**
 * Bookings Tab Screen
 * User's appointments list (placeholder - requires auth)
 */

import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Text, Card, Button, EmptyState } from '../../../components';

type TabType = 'upcoming' | 'past';

export default function BookingsScreen() {
  const { colors, spacing } = useTheme();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { padding: spacing.lg }]}>
        <Text variant="h1">Mes rendez-vous</Text>
      </View>

      {/* Tab Toggle */}
      <View
        style={[
          styles.tabContainer,
          {
            marginHorizontal: spacing.lg,
            marginBottom: spacing.lg,
            backgroundColor: colors.surfaceSecondary,
            borderRadius: 12,
            padding: 4,
          },
        ]}
      >
        <Pressable
          onPress={() => setActiveTab('upcoming')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'upcoming' ? colors.surface : 'transparent',
              borderRadius: 8,
            },
          ]}
        >
          <Text
            variant="body"
            color={activeTab === 'upcoming' ? 'text' : 'textSecondary'}
            style={{ fontWeight: activeTab === 'upcoming' ? '600' : '400' }}
          >
            À venir
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('past')}
          style={[
            styles.tab,
            {
              backgroundColor: activeTab === 'past' ? colors.surface : 'transparent',
              borderRadius: 8,
            },
          ]}
        >
          <Text
            variant="body"
            color={activeTab === 'past' ? 'text' : 'textSecondary'}
            style={{ fontWeight: activeTab === 'past' ? '600' : '400' }}
          >
            Passés
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingHorizontal: spacing.lg }]}>
        <Card padding="lg" shadow="sm">
          <EmptyState
            icon="log-in-outline"
            title="Connectez-vous"
            description="Connectez-vous pour voir vos rendez-vous et en prendre de nouveaux"
            actionLabel="Se connecter"
            onAction={() => {
              // TODO: Navigate to auth screen
              console.log('Navigate to login');
            }}
          />
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    // Dynamic styles
  },
  tabContainer: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
});
