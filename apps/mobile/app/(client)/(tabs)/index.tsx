/**
 * Home Tab Screen
 * Welcome screen with category cards and upcoming bookings
 */

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../theme';
import {
  Text,
  Card,
  CategoryCard,
  ProviderCard,
  ProviderCardSkeleton,
  EmptyState,
} from '../../../components';
import { useTopProviders, useNavigateToProvider } from '../../../hooks';

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

export default function HomeScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { navigateToProvider, isLoading } = useNavigateToProvider();

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
          <Text variant="h1">Bonjour</Text>
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
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="calendar-outline"
              title="Pas de RDV à venir"
              description="Réservez votre prochain rendez-vous"
              actionLabel="Rechercher"
              onAction={() => router.push('/(client)/(tabs)/search')}
            />
          </Card>
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
});
