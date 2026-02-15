/**
 * Statistics Screen
 * Detailed stats for the provider: bookings, revenue, rates
 */

import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Loader, StatCard, Card } from '../../components';
import { useProvider } from '../../contexts';
import { useProviderStats } from '../../hooks';

function formatPrice(centimes: number): string {
  return (centimes / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

export default function StatsScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { providerId, provider } = useProvider();
  const { stats, isLoading, refresh } = useProviderStats(providerId);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { padding: spacing.lg, paddingBottom: spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ marginLeft: spacing.md }}>
          Statistiques
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Loader />
        </View>
      ) : stats ? (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} />}
        >
          {/* Revenue card */}
          <Card padding="lg" shadow="md" style={{ marginBottom: spacing.lg }}>
            <Text variant="caption" color="textSecondary">Revenus ce mois</Text>
            <Text variant="h1" style={{ marginTop: spacing.xs }}>
              {formatPrice(stats.monthlyRevenue)}
            </Text>
            <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
              {stats.monthlyBookingsCount} réservation{stats.monthlyBookingsCount > 1 ? 's' : ''}
            </Text>
          </Card>

          {/* Stats grid */}
          <View style={[styles.grid, { gap: spacing.sm }]}>
            <View style={styles.gridItem}>
              <StatCard
                icon="calendar-outline"
                label="Total RDV"
                value={stats.total}
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                icon="checkmark-circle-outline"
                label="Confirmés"
                value={stats.confirmed}
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                icon="hourglass-outline"
                label="En attente"
                value={stats.pending}
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                icon="close-circle-outline"
                label="Annulés"
                value={stats.cancelled}
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                icon="alert-circle-outline"
                label="No-shows"
                value={stats.noshow}
              />
            </View>
            <View style={styles.gridItem}>
              <StatCard
                icon="trending-up-outline"
                label="Taux réussite"
                value={`${stats.completionRate}%`}
              />
            </View>
          </View>

          {/* Rating */}
          {provider?.rating && (
            <Card padding="md" shadow="sm" style={{ marginTop: spacing.lg }}>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={24} color="#FBBF24" />
                <Text variant="h2" style={{ marginLeft: spacing.sm }}>
                  {provider.rating.average.toFixed(1)}
                </Text>
                <Text variant="caption" color="textSecondary" style={{ marginLeft: spacing.sm }}>
                  ({provider.rating.count} avis)
                </Text>
              </View>
            </Card>
          )}
        </ScrollView>
      ) : (
        <View style={styles.center}>
          <Text variant="body" color="textSecondary">Aucune donnée disponible</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    width: '48%',
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
