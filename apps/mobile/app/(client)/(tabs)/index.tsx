/**
 * Home Tab Screen
 * Welcome screen with category cards and upcoming bookings
 */

import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from '../../../components';
import { useTopProviders, useNavigateToProvider, useNextBooking } from '../../../hooks';
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
  const router = useRouter();
  const { navigateToProvider, isLoading } = useNavigateToProvider();
  const { userData, isAuthenticated } = useAuth();
  const { nextBooking, loading: loadingNextBooking } = useNextBooking();

  // Get user's first name
  const firstName = userData?.displayName?.split(' ')[0] || '';

  // Fetch top rated providers for suggestions
  const { providers: suggestions, loading: loadingSuggestions } = useTopProviders(5);

  const handleCategoryPress = (categoryId: string) => {
    router.push({
      pathname: '/(client)/(tabs)/search',
      params: { category: categoryId },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      >
        {/* Header */}
        <View style={[styles.header, { padding: spacing.lg }]}>
          <Text variant="h1">
            {isAuthenticated && firstName ? `Bonjour ${firstName}` : 'Bonjour'}
          </Text>
          <Text variant="body" color="textSecondary" style={{ marginTop: spacing.xs }}>
            Trouvez votre prochain rendez-vous
          </Text>
        </View>

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
          {loadingNextBooking ? (
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
                <View style={[styles.bookingIconContainer, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                  <Ionicons name="calendar" size={24} color={colors.primary} />
                </View>
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

        {/* Suggestions */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text variant="h3" style={{ marginBottom: spacing.md }}>
            Suggestions
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
                  onPress={() => navigateToProvider(provider.slug)}
                  isLoading={isLoading(provider.slug)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  bookingCardSkeleton: {
    paddingVertical: 8,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 4,
  },
});
