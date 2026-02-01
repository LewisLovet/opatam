/**
 * Pro Dashboard Placeholder
 * Temporary screen for providers until the full Pro interface is implemented
 */

import React from 'react';
import { View, StyleSheet, SafeAreaView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button, Card } from '../../components';
import { useAuth } from '../../contexts';

export default function ProDashboardScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { userData, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { padding: spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text variant="h1">Espace Pro</Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: spacing.xs }}>
            Bienvenue, {userData?.displayName || 'Professionnel'}
          </Text>
        </View>

        {/* Main Card */}
        <Card padding="lg" shadow="md" style={[styles.mainCard, { marginTop: spacing.xl }]}>
          <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
            <Ionicons name="construct-outline" size={48} color={colors.primary} />
          </View>

          <Text variant="h2" style={[styles.cardTitle, { marginTop: spacing.lg }]}>
            Interface Pro en construction
          </Text>

          <Text
            variant="body"
            color="textSecondary"
            style={[styles.cardDescription, { marginTop: spacing.sm }]}
          >
            L'application mobile pour les professionnels arrive bientôt. En attendant, utilisez l'interface web pour gérer votre activité.
          </Text>

          {/* Features coming soon */}
          <View style={[styles.featuresList, { marginTop: spacing.lg }]}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text variant="body" style={{ marginLeft: spacing.sm, flex: 1 }}>
                Gestion des rendez-vous
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text variant="body" style={{ marginLeft: spacing.sm, flex: 1 }}>
                Calendrier et disponibilités
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text variant="body" style={{ marginLeft: spacing.sm, flex: 1 }}>
                Statistiques et revenus
              </Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
              <Text variant="body" style={{ marginLeft: spacing.sm, flex: 1 }}>
                Notifications en temps réel
              </Text>
            </View>
          </View>
        </Card>

        {/* Web link info */}
        <Card padding="md" shadow="sm" style={{ marginTop: spacing.md }}>
          <View style={styles.webInfoRow}>
            <View style={[styles.webIconContainer, { backgroundColor: '#e4effa' }]}>
              <Ionicons name="laptop-outline" size={24} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text variant="body" style={{ fontWeight: '600' }}>
                Accédez à l'interface web
              </Text>
              <Text variant="caption" color="textSecondary">
                opatam.com/pro
              </Text>
            </View>
            <Ionicons name="open-outline" size={20} color={colors.textSecondary} />
          </View>
        </Card>

        {/* Logout button */}
        <Button
          variant="outline"
          title="Se déconnecter"
          onPress={handleLogout}
          style={{ marginTop: spacing.xl }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    // Dynamic styles
  },
  mainCard: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardDescription: {
    textAlign: 'center',
  },
  featuresList: {
    alignSelf: 'stretch',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  webIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
