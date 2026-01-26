/**
 * Profile Tab Screen
 * User profile and settings (placeholder - requires auth)
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../../../theme';
import { Text, Card, EmptyState } from '../../../components';

export default function ProfileScreen() {
  const { colors, spacing } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { padding: spacing.lg }]}>
        <Text variant="h1">Profil</Text>
      </View>

      {/* Content */}
      <View style={[styles.content, { paddingHorizontal: spacing.lg }]}>
        <Card padding="lg" shadow="sm">
          <EmptyState
            icon="person-outline"
            title="Connectez-vous"
            description="Accédez à votre profil, vos informations et vos préférences"
            actionLabel="Se connecter"
            onAction={() => {
              // TODO: Navigate to auth screen
              console.log('Navigate to login');
            }}
          />
        </Card>

        {/* App Info */}
        <View style={[styles.appInfo, { marginTop: spacing.xl }]}>
          <Text variant="caption" color="textMuted" align="center">
            Opatam v1.0.0
          </Text>
          <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xs }}>
            Réservez vos rendez-vous en toute simplicité
          </Text>
        </View>
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
  content: {
    flex: 1,
  },
  appInfo: {
    alignItems: 'center',
  },
});
