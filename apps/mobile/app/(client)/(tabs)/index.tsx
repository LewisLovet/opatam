/**
 * Home Tab Screen — Redesigned
 * Gradient header with search bar, image category carousel, enhanced bookings,
 * re-book action, and dynamic city name in suggestions.
 */

import { providerService } from '@booking-app/firebase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import {
  Text,
  Card,
  CategoryCard,
  ProviderCard,
  ProviderCardSkeleton,
  EmptyState,
  Avatar,
} from '../../../components';
import { useUserLocation, useNearbyProviders, useNavigateToProvider, useClientBookings } from '../../../hooks';
import { useAuth } from '../../../contexts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const categoryImages: Record<string, string> = {
  digital: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400',
  beauty: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=400',
  coaching: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
  wellness: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400',
  sport: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
  training: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=400',
  artisan: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400',
  audiovisual: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400',
};

const categories = [
  { id: 'digital', label: 'Digital' },
  { id: 'beauty', label: 'Beauté' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'wellness', label: 'Bien-être' },
  { id: 'sport', label: 'Sport' },
  { id: 'training', label: 'Formation' },
  { id: 'artisan', label: 'Artisans' },
  { id: 'audiovisual', label: 'Audiovisuel' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(dt: any): Date {
  if (dt instanceof Date) return dt;
  if (dt?.toDate) return dt.toDate();
  return new Date(dt);
}

function formatBookingDate(datetime: Date | any): string {
  const date = toDate(datetime);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Aujourd'hui à ${timeStr}`;
  if (isTomorrow) return `Demain à ${timeStr}`;

  const dateStr = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `${dateStr} à ${timeStr}`;
}

/** Returns "Dans Xh", "Dans X min", or null if booking is in the past */
function getTimeUntilChip(bookingDate: Date): string | null {
  const now = new Date();
  const diffMs = bookingDate.getTime() - now.getTime();
  if (diffMs <= 0) return null;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 60) return `Dans ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;
  return remainMin > 0 ? `Dans ${diffH}h${remainMin.toString().padStart(2, '0')}` : `Dans ${diffH}h`;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { navigateToProvider, isLoading } = useNavigateToProvider();
  const { userData, isAuthenticated } = useAuth();
  const { upcoming, past, loading: loadingBookings, refresh: refreshBookings } = useClientBookings();

  // Refresh bookings when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        refreshBookings();
      }
    }, [isAuthenticated, refreshBookings])
  );

  const nextBooking = upcoming.length > 0 ? upcoming[0] : null;
  const recentPast = past.slice(0, 3);
  const firstName = userData?.displayName?.split(' ')[0] || '';

  // Next booking derived values
  const nextBookingDate = nextBooking ? toDate(nextBooking.datetime) : null;
  const nextBookingBarColor = nextBooking?.status === 'confirmed' ? colors.success : colors.warning;
  const nextBookingTimeChip = nextBookingDate ? getTimeUntilChip(nextBookingDate) : null;

  // Nearby providers
  const { location: userLocation, loading: locationLoading } = useUserLocation();
  const { providers: suggestions, loading: loadingSuggestions, isNearby, refresh: refreshSuggestions } = useNearbyProviders(userLocation, locationLoading, 5);

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshBookings(), refreshSuggestions()]);
    setRefreshing(false);
  }, [refreshBookings, refreshSuggestions]);

  // Re-book handler
  const [rebookingId, setRebookingId] = useState<string | null>(null);
  const handleRebook = useCallback(async (providerId: string, bookingId: string) => {
    setRebookingId(bookingId);
    try {
      const provider = await providerService.getById(providerId);
      if (provider?.slug) {
        router.push(`/(client)/provider/${provider.slug}` as any);
      }
    } catch {
      // Silent fail — provider may have been deleted
    } finally {
      setRebookingId(null);
    }
  }, [router]);

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: '/(client)/(tabs)/search',
      params: { category: categoryId },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Gradient Header with Search Bar ── */}
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={{ paddingTop: insets.top }}
      >
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>
            {isAuthenticated && firstName ? `Bonjour ${firstName}` : 'Bonjour'}
          </Text>
          <Text variant="body" style={{ color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs }}>
            Trouvez votre prochain rendez-vous
          </Text>

          {/* Fake search bar */}
          <Pressable
            onPress={() => router.push('/(client)/(tabs)/search')}
            style={({ pressed }) => [
              styles.fakeSearchBar,
              {
                backgroundColor: 'rgba(255,255,255,0.15)',
                borderRadius: radius.full,
                opacity: pressed ? 0.8 : 1,
                marginTop: spacing.md,
              },
            ]}
          >
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.7)" />
            <Text
              variant="body"
              style={{ color: 'rgba(255,255,255,0.5)', marginLeft: spacing.sm, flex: 1 }}
            >
              Rechercher un prestataire...
            </Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing['3xl'] }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Categories ── */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text variant="h3" style={{ marginBottom: spacing.md, paddingHorizontal: spacing.lg }}>
            Catégories
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
          >
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                id={category.id}
                label={category.label}
                imageUrl={categoryImages[category.id]}
                onPress={() => handleCategoryPress(category.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* ── Prochain RDV ── */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <Text variant="h3" style={{ marginBottom: spacing.md }}>
            Prochain RDV
          </Text>
          {loadingBookings ? (
            <Card padding="lg" shadow="sm">
              <View style={styles.bookingCardSkeleton}>
                <View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.surfaceSecondary }]} />
                <View style={[styles.skeletonLine, { width: '80%', backgroundColor: colors.surfaceSecondary, marginTop: 8 }]} />
                <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.surfaceSecondary, marginTop: 8 }]} />
              </View>
            </Card>
          ) : nextBooking ? (
            <Pressable
              onPress={() => router.push('/(client)/(tabs)/bookings')}
              style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
            >
              <View style={[styles.nextBookingCard, { backgroundColor: colors.primaryLight, borderRadius: radius.lg, overflow: 'hidden' }]}>
                {/* Color bar */}
                <View style={{ width: 4, backgroundColor: nextBookingBarColor, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg }} />
                <View style={{ flex: 1, padding: spacing.lg, flexDirection: 'row', alignItems: 'center' }}>
                  <Avatar
                    size="md"
                    name={nextBooking.providerName}
                    imageUrl={nextBooking.providerPhoto}
                    style={{ marginRight: 12 }}
                  />
                  <View style={styles.bookingInfo}>
                    <Text variant="body" style={{ fontWeight: '600' }}>
                      {nextBooking.serviceName}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                      {nextBooking.providerName}
                    </Text>
                    <Text variant="caption" color="primary" style={{ marginTop: 4, fontWeight: '500' }}>
                      {formatBookingDate(nextBooking.datetime)}
                    </Text>
                  </View>
                  {nextBookingTimeChip ? (
                    <View style={[styles.timeChip, { backgroundColor: colors.surface, borderRadius: radius.full }]}>
                      <Text variant="caption" color="primary" style={{ fontWeight: '600', fontSize: 11 }}>
                        {nextBookingTimeChip}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.bookingArrow, { backgroundColor: colors.surface }]}>
                      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/(client)/(tabs)/search')}
              style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
            >
              <LinearGradient
                colors={[colors.primaryLight, colors.surface]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.emptyBookingCard, { borderRadius: radius.lg, borderColor: colors.primary + '20', borderWidth: 1 }]}
              >
                <View style={[styles.emptyBookingIcon, { backgroundColor: colors.primary + '15', borderRadius: radius.full }]}>
                  <Ionicons name="calendar-outline" size={28} color={colors.primary} />
                </View>
                <Text variant="body" style={{ fontWeight: '600', marginTop: spacing.md }}>
                  Pas de RDV à venir
                </Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
                  Trouvez un prestataire et réservez votre prochain rendez-vous en quelques clics
                </Text>
                <View style={[styles.emptyBookingBtn, { backgroundColor: colors.primary, borderRadius: radius.full, marginTop: spacing.lg }]}>
                  <Ionicons name="search-outline" size={16} color="#FFF" />
                  <Text variant="body" style={{ color: '#FFF', fontWeight: '600', marginLeft: spacing.xs }}>
                    Rechercher
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        {/* ── Derniers RDV ── */}
        {!loadingBookings && recentPast.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text variant="h3">Derniers RDV</Text>
              <Pressable
                onPress={() => router.push({ pathname: '/(client)/(tabs)/bookings', params: { tab: 'past' } })}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
                  Voir tout
                </Text>
              </Pressable>
            </View>
            {recentPast.map((booking) => {
              const bookingDate = toDate(booking.datetime);
              const dateStr = bookingDate.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
              });
              const isPast = bookingDate <= new Date() && booking.status === 'confirmed';

              return (
                <Pressable
                  key={booking.id}
                  onPress={() => router.push(`/(client)/booking-detail/${booking.id}`)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Card padding="md" shadow="sm" style={{ marginBottom: 8 }}>
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
                          {booking.providerName} — {dateStr}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                        {isPast && (
                          <Pressable
                            onPress={() => handleRebook(booking.providerId, booking.id)}
                            disabled={rebookingId === booking.id}
                            style={({ pressed }) => [
                              styles.rebookChip,
                              { backgroundColor: colors.primaryLight, opacity: pressed ? 0.7 : 1 },
                            ]}
                          >
                            {rebookingId === booking.id ? (
                              <ActivityIndicator size={12} color={colors.primary} />
                            ) : (
                              <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                            )}
                            <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary, marginLeft: 2 }}>
                              Réserver
                            </Text>
                          </Pressable>
                        )}
                        {isPast && (
                          <View style={[styles.reviewChip, { backgroundColor: '#fef3c7' }]}>
                            <Ionicons name="star" size={14} color="#f59e0b" />
                            <Text style={{ fontSize: 11, fontWeight: '600', color: '#f59e0b', marginLeft: 2 }}>
                              Avis
                            </Text>
                          </View>
                        )}
                        {!isPast && (
                          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        )}
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Suggestions ── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text variant="h3" style={{ marginBottom: spacing.md }}>
            {isNearby
              ? `Près de chez vous${userLocation?.city ? ` \u00B7 à ${userLocation.city}` : ''}`
              : 'Suggestions'}
          </Text>

          {loadingSuggestions ? (
            <View style={{ gap: spacing.md }}>
              {[1, 2, 3].map((i) => (
                <ProviderCardSkeleton key={i} />
              ))}
            </View>
          ) : suggestions.length === 0 ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="storefront-outline"
                title="Aucune suggestion"
                description="Aucun prestataire disponible pour le moment"
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {suggestions.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  photoURL={provider.coverPhotoURL || provider.photoURL}
                  businessName={provider.businessName}
                  category={provider.category}
                  city={provider.cities[0] || ''}
                  rating={provider.rating}
                  minPrice={provider.minPrice}
                  distance={isNearby ? provider.distance : undefined}
                  onPress={() => navigateToProvider(provider.slug)}
                  isLoading={isLoading(provider.slug)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fakeSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  nextBookingCard: {
    flexDirection: 'row',
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingInfo: {
    flex: 1,
  },
  bookingArrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  reviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rebookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bookingCardSkeleton: {
    paddingVertical: 8,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
  },
});
