/**
 * Bookings Tab Screen
 * User's appointments list with upcoming/past tabs
 */

import type { TFunction } from 'i18next';
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../theme';
import { Text, Card, EmptyState, Avatar } from '../../../components';
import { useClientBookings } from '../../../hooks';
import { useAuth } from '../../../contexts';
import type { Booking, BookingStatus } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

type TabType = 'upcoming' | 'past';

// Helper to format booking date
function formatBookingDate(datetime: Date | any, t: TFunction, locale: string): string {
  const date = datetime instanceof Date
    ? datetime
    : datetime?.toDate?.() || new Date(datetime);

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return t('bookings.date.todayAt', { time: timeStr });
  }
  if (isTomorrow) {
    return t('bookings.date.tomorrowAt', { time: timeStr });
  }

  const dateStr = date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return t('bookings.date.dayAt', { date: dateStr, time: timeStr });
}

// Get status badge config
function getStatusConfig(status: BookingStatus, t: TFunction): { label: string; color: string; bgColor: string } {
  switch (status) {
    case 'confirmed':
      return { label: t('bookings.status.confirmed'), color: '#16a34a', bgColor: '#dcfce7' };
    case 'pending':
      return { label: t('bookings.status.pending'), color: '#ca8a04', bgColor: '#fef9c3' };
    case 'cancelled':
      return { label: t('bookings.status.cancelled'), color: '#dc2626', bgColor: '#fee2e2' };
    case 'noshow':
      return { label: t('bookings.status.noshow'), color: '#6b7280', bgColor: '#f3f4f6' };
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
  const { t, i18n } = useTranslation();
  // Locale for date/time rendering (24h clock in both languages)
  const dateLocale = i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  const statusConfig = getStatusConfig(booking.status, t);

  return (
    <Pressable onPress={onPress}>
      <Card padding="md" shadow="sm" style={{ marginBottom: 12 }}>
        <View style={styles.bookingCard}>
          <Avatar
            size="md"
            name={booking.providerName}
            imageUrl={booking.providerPhoto}
            style={{ marginRight: 12 }}
          />
          <View style={styles.bookingInfo}>
            <Text variant="body" style={{ fontWeight: '600' }}>
              {booking.serviceName}
            </Text>
            <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              {booking.providerName}
            </Text>
            <View style={styles.bookingMeta}>
              <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
                {formatBookingDate(booking.datetime, t, dateLocale)}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
              <Text variant="caption" color="textSecondary" style={{ marginLeft: 4 }} numberOfLines={1}>
                {booking.locationAddress || booking.locationName}
              </Text>
            </View>
            {booking.price === 0 && !booking.priceMax ? (
              <Text variant="caption" style={{ fontWeight: '700', color: colors.primary, marginLeft: 8 }}>
                {t('common.free')}
              </Text>
            ) : booking.priceMax ? (
              <Text variant="caption" style={{ fontWeight: '700', color: colors.primary, marginLeft: 8 }}>
                {t('bookings.priceRange', { min: (booking.price / 100).toFixed(0), max: (booking.priceMax / 100).toFixed(0) })}
              </Text>
            ) : booking.originalPrice != null && booking.originalPrice > booking.price ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 4 }}>
                <Text variant="caption" style={{ textDecorationLine: 'line-through', color: colors.textMuted }}>
                  {t('bookings.price', { price: (booking.originalPrice / 100).toFixed(0) })}
                </Text>
                <Text variant="caption" style={{ fontWeight: '700', color: '#E11D48' }}>
                  {t('bookings.price', { price: (booking.price / 100).toFixed(0) })}
                </Text>
              </View>
            ) : (
              <Text variant="caption" style={{ fontWeight: '700', color: colors.primary, marginLeft: 8 }}>
                {t('bookings.price', { price: (booking.price / 100).toFixed(0) })}
              </Text>
            )}
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
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { isAuthenticated } = useAuth();
  const { upcoming, past, loading, error, refresh } = useClientBookings();
  const [activeTab, setActiveTab] = useState<TabType>(tab === 'past' ? 'past' : 'upcoming');

  useEffect(() => {
    if (tab === 'past') setActiveTab('past');
  }, [tab]);

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
            <Text variant="h1" style={{ color: '#FFFFFF' }}>{t('bookings.title')}</Text>
          </View>
        </View>
        <View style={[styles.content, { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }]}>
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="log-in-outline"
              title={t('bookings.notAuth.title')}
              description={t('bookings.notAuth.description')}
              actionLabel={t('bookings.notAuth.action')}
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
          <Text variant="h1" style={{ color: '#FFFFFF' }}>{t('bookings.title')}</Text>
        </View>
      </View>

      {/* Tab Toggle */}
      <View
        style={[
          styles.tabContainer,
          {
            marginHorizontal: spacing.lg,
            marginTop: spacing.md,
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
            {t('bookings.tabs.upcoming')} {upcoming.length > 0 && `(${upcoming.length})`}
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
            {t('bookings.tabs.past')}
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
              title={t('bookings.errorTitle')}
              description={error}
              actionLabel={t('common.retry')}
              onAction={refresh}
            />
          </Card>
        ) : currentBookings.length === 0 ? (
          // Empty state — gradient design
          <Pressable
            onPress={activeTab === 'upcoming' ? () => router.push('/(client)/(tabs)/search') : undefined}
            disabled={activeTab !== 'upcoming'}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <LinearGradient
              colors={[colors.primaryLight, colors.surface]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.emptyBookingCard, { borderRadius: radius.lg, borderColor: colors.primary + '20', borderWidth: 1 }]}
            >
              <View style={[styles.emptyBookingIcon, { backgroundColor: colors.primary + '15', borderRadius: radius.full }]}>
                <Ionicons
                  name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
                  size={28}
                  color={colors.primary}
                />
              </View>
              <Text variant="body" style={{ fontWeight: '600', marginTop: spacing.md }}>
                {activeTab === 'upcoming' ? t('bookings.empty.upcomingTitle') : t('bookings.empty.pastTitle')}
              </Text>
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
                {activeTab === 'upcoming'
                  ? t('bookings.empty.upcomingDescription')
                  : t('bookings.empty.pastDescription')}
              </Text>
              {activeTab === 'upcoming' && (
                <View style={[styles.emptyBookingBtn, { backgroundColor: colors.primary, borderRadius: radius.full, marginTop: spacing.lg }]}>
                  <Ionicons name="search-outline" size={16} color="#FFF" />
                  <Text variant="body" style={{ color: '#FFF', fontWeight: '600', marginLeft: spacing.xs }}>
                    {t('bookings.empty.searchAction')}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>
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
  emptyBookingCard: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  emptyBookingIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});
