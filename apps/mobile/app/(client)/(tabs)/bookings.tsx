/**
 * Bookings Tab Screen
 * User's appointments list with upcoming/past tabs
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text, Card, EmptyState } from '../../../components';
import { useClientBookings } from '../../../hooks';
import { useAuth } from '../../../contexts';
import type { Booking, BookingStatus } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

type TabType = 'upcoming' | 'past';

// Helper to format booking date
function formatBookingDate(datetime: Date | any): string {
  const date = datetime instanceof Date
    ? datetime
    : datetime?.toDate?.() || new Date(datetime);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Aujourd'hui à ${timeStr}`;
  }
  if (isTomorrow) {
    return `Demain à ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return `${dateStr} à ${timeStr}`;
}

// Get status badge config
function getStatusConfig(status: BookingStatus): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'confirmed':
      return { label: 'Confirmé', color: '#16a34a', bgColor: '#dcfce7' };
    case 'pending':
      return { label: 'En attente', color: '#ca8a04', bgColor: '#fef9c3' };
    case 'cancelled':
      return { label: 'Annulé', color: '#dc2626', bgColor: '#fee2e2' };
    case 'noshow':
      return { label: 'Absent', color: '#6b7280', bgColor: '#f3f4f6' };
    default:
      return { label: status, color: '#6b7280', bgColor: '#f3f4f6' };
  }
}

// Booking card component
function BookingCard({
  booking,
  colors,
  onPress,
}: {
  booking: WithId<Booking>;
  colors: any;
  onPress: () => void;
}) {
  const statusConfig = getStatusConfig(booking.status);

  return (
    <Pressable onPress={onPress}>
      <Card padding="md" shadow="sm" style={{ marginBottom: 12 }}>
        <View style={styles.bookingCard}>
          <View style={[styles.bookingIconContainer, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
            <Ionicons name="calendar" size={22} color={colors.primary} />
          </View>
          <View style={styles.bookingInfo}>
            <Text variant="body" style={{ fontWeight: '600' }}>
              {booking.serviceName}
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              {booking.providerName}
            </Text>
            <View style={styles.bookingMeta}>
              <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
                {formatBookingDate(booking.datetime)}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </View>
        {(booking.locationAddress || booking.locationName) && (
          <View style={[styles.locationRow, { borderTopColor: colors.border }]}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text variant="caption" color="textSecondary" style={{ marginLeft: 4 }} numberOfLines={1}>
              {booking.locationAddress || booking.locationName}
            </Text>
          </View>
        )}
      </Card>
    </Pressable>
  );
}

// Skeleton loader
function BookingCardSkeleton({ colors }: { colors: any }) {
  return (
    <Card padding="md" shadow="sm" style={{ marginBottom: 12 }}>
      <View style={styles.bookingCard}>
        <View style={[styles.bookingIconContainer, { backgroundColor: colors.surfaceSecondary }]} />
        <View style={styles.bookingInfo}>
          <View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.surfaceSecondary }]} />
          <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.surfaceSecondary, marginTop: 8 }]} />
          <View style={[styles.skeletonLine, { width: '50%', backgroundColor: colors.surfaceSecondary, marginTop: 8 }]} />
        </View>
      </View>
    </Card>
  );
}

export default function BookingsScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { upcoming, past, loading, error, refresh } = useClientBookings();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  // Refresh bookings when screen comes into focus (e.g., after cancellation)
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refresh();
      }
    }, [isAuthenticated, refresh])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const currentBookings = activeTab === 'upcoming' ? upcoming : past;

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="h1" style={{ color: '#FFFFFF' }}>Mes rendez-vous</Text>
          </View>
        </View>
        <View style={[styles.content, { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }]}>
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="log-in-outline"
              title="Connectez-vous"
              description="Connectez-vous pour voir vos rendez-vous et en prendre de nouveaux"
              actionLabel="Se connecter"
              onAction={() => router.push('/(auth)/login')}
            />
          </Card>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ── */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>Mes rendez-vous</Text>
        </View>
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
            À venir {upcoming.length > 0 && `(${upcoming.length})`}
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
            Historique
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {loading && !refreshing ? (
          // Loading state
          <>
            <BookingCardSkeleton colors={colors} />
            <BookingCardSkeleton colors={colors} />
            <BookingCardSkeleton colors={colors} />
          </>
        ) : error ? (
          // Error state
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="alert-circle-outline"
              title="Erreur"
              description={error}
              actionLabel="Réessayer"
              onAction={refresh}
            />
          </Card>
        ) : currentBookings.length === 0 ? (
          // Empty state
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
              title={activeTab === 'upcoming' ? 'Aucun RDV à venir' : 'Aucun historique'}
              description={
                activeTab === 'upcoming'
                  ? 'Vous n\'avez pas de rendez-vous prévu'
                  : 'Vos anciens rendez-vous apparaîtront ici'
              }
              actionLabel={activeTab === 'upcoming' ? 'Rechercher' : undefined}
              onAction={activeTab === 'upcoming' ? () => router.push('/(client)/(tabs)/search') : undefined}
            />
          </Card>
        ) : (
          // Bookings list
          currentBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              colors={colors}
              onPress={() => router.push(`/(client)/booking-detail/${booking.id}`)}
            />
          ))
        )}
      </ScrollView>
    </View>
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
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bookingInfo: {
    flex: 1,
  },
  bookingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
  },
});
