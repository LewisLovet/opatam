/**
 * Home Tab Screen
 * Welcome screen with category cards and upcoming bookings
 */

import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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

// Category images from Unsplash
const categoryImages: Record<string, string> = {
  coiffure: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
  beaute: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=400',
  massage: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400',
  coaching: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
  sante: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=400',
  'bien-etre': 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400',
};

// Categories with images
const categories = [
  { id: 'coiffure', label: 'Coiffure' },
  { id: 'beaute', label: 'Beauté' },
  { id: 'massage', label: 'Massage' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'sante', label: 'Santé' },
  { id: 'bien-etre', label: 'Bien-être' },
];

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
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return `${dateStr} à ${timeStr}`;
}

export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { navigateToProvider, isLoading } = useNavigateToProvider();
  const { userData, isAuthenticated } = useAuth();
  const { upcoming, past, loading: loadingBookings } = useClientBookings();
  const nextBooking = upcoming.length > 0 ? upcoming[0] : null;
  const recentPast = past.slice(0, 3); // Show up to 3 recent past bookings

  // Get user's first name
  const firstName = userData?.displayName?.split(' ')[0] || '';

  // Fetch nearby providers (falls back to top-rated if no location)
  const { location: userLocation, loading: locationLoading } = useUserLocation();
  const { providers: suggestions, loading: loadingSuggestions, isNearby } = useNearbyProviders(userLocation, locationLoading, 5);

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: '/(client)/(tabs)/search',
      params: { category: categoryId },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ── */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>
            {isAuthenticated && firstName ? `Bonjour ${firstName}` : 'Bonjour'}
          </Text>
          <Text variant="body" style={{ color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs }}>
            Trouvez votre prochain rendez-vous
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      >

        {/* Categories Carousel */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            variant="h3"
            style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}
          >
            Catégories
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
            }}
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

        {/* Upcoming Booking */}
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
            <Card padding="lg" shadow="sm">
              <View style={styles.bookingCard}>
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
                <Pressable
                  onPress={() => router.push('/(client)/(tabs)/bookings')}
                  style={({ pressed }) => [
                    styles.bookingArrow,
                    { backgroundColor: colors.surfaceSecondary, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>
            </Card>
          ) : (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="calendar-outline"
                title="Pas de RDV à venir"
                description="Réservez votre prochain rendez-vous"
                actionLabel="Rechercher"
                onAction={() => router.push('/(client)/(tabs)/search')}
              />
            </Card>
          )}
        </View>

        {/* Past Bookings */}
        {!loadingBookings && recentPast.length > 0 && (
          <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
              <Text variant="h3">Derniers RDV</Text>
              <Pressable
                onPress={() => router.push('/(client)/(tabs)/bookings')}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
                  Voir tout
                </Text>
              </Pressable>
            </View>
            {recentPast.map((booking) => {
              const bookingDate = booking.datetime instanceof Date
                ? booking.datetime
                : (booking.datetime as any)?.toDate?.() || new Date(booking.datetime);
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
                      {isPast ? (
                        <View style={[styles.reviewChip, { backgroundColor: '#fef3c7' }]}>
                          <Ionicons name="star" size={14} color="#f59e0b" />
                          <Text style={{ fontSize: 11, fontWeight: '600', color: '#f59e0b', marginLeft: 2 }}>
                            Avis
                          </Text>
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                      )}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Suggestions */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text variant="h3" style={{ marginBottom: spacing.md }}>
            {isNearby ? 'Près de chez vous' : 'Suggestions'}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    // Dynamic styles applied inline
  },
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bookingIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
  reviewChip: {
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
