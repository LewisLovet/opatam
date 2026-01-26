/**
 * Search Tab Screen
 * Search providers with filters
 * TODO: Connect to Firebase when ready
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../theme';
import {
  Text,
  SearchBar,
  CategoryPills,
  CitySelect,
  ProviderCard,
  EmptyState,
} from '../../../components';
import type { Rating } from '@booking-app/shared';

// Categories list
const categories = [
  { id: 'coiffure', label: 'Coiffure' },
  { id: 'beaute', label: 'Beauté' },
  { id: 'massage', label: 'Massage' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'sante', label: 'Santé' },
];

// Cities list
const cities = ['Paris', 'Lyon', 'Marseille', 'Bordeaux', 'Lille', 'Toulouse', 'Nice'];

// Mock provider type for display
interface ProviderDisplay {
  id: string;
  slug: string;
  photoURL: string | null;
  businessName: string;
  category: string;
  city: string;
  rating: Rating;
  minPrice: number | null;
}

// Mock data (will be replaced with Firebase)
const mockProviders: ProviderDisplay[] = [
  {
    id: '1',
    slug: 'studio-beaute-paris',
    photoURL: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400',
    businessName: 'Studio Beauté Paris',
    category: 'Coiffure',
    city: 'Paris',
    rating: { average: 4.8, count: 124, distribution: { 1: 2, 2: 3, 3: 8, 4: 25, 5: 86 } },
    minPrice: 2500,
  },
  {
    id: '2',
    slug: 'zen-massage',
    photoURL: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400',
    businessName: 'Zen Massage',
    category: 'Massage',
    city: 'Paris',
    rating: { average: 4.9, count: 89, distribution: { 1: 1, 2: 1, 3: 5, 4: 12, 5: 70 } },
    minPrice: 4500,
  },
  {
    id: '3',
    slug: 'coach-fitness-pro',
    photoURL: null,
    businessName: 'Coach Fitness Pro',
    category: 'Coaching',
    city: 'Lyon',
    rating: { average: 4.7, count: 56, distribution: { 1: 0, 2: 2, 3: 4, 4: 15, 5: 35 } },
    minPrice: 5000,
  },
  {
    id: '4',
    slug: 'beaute-naturelle',
    photoURL: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400',
    businessName: 'Beauté Naturelle',
    category: 'Beauté',
    city: 'Lyon',
    rating: { average: 4.6, count: 78, distribution: { 1: 1, 2: 2, 3: 6, 4: 20, 5: 49 } },
    minPrice: 3000,
  },
  {
    id: '5',
    slug: 'spa-wellness',
    photoURL: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400',
    businessName: 'Spa & Wellness',
    category: 'Massage',
    city: 'Marseille',
    rating: { average: 4.5, count: 45, distribution: { 1: 0, 2: 1, 3: 4, 4: 15, 5: 25 } },
    minPrice: 6000,
  },
];

export default function SearchScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.category || null
  );
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Data state
  const [providers, setProviders] = useState<ProviderDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load providers (mock implementation)
  const loadProviders = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Filter mock data
      let results = [...mockProviders];

      if (selectedCategory) {
        results = results.filter(
          (p) => p.category.toLowerCase() === selectedCategory.toLowerCase()
        );
      }

      if (selectedCity) {
        results = results.filter(
          (p) => p.city.toLowerCase() === selectedCity.toLowerCase()
        );
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        results = results.filter(
          (p) =>
            p.businessName.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        );
      }

      setProviders(results);
    } catch (err) {
      console.error('Error loading providers:', err);
      setError('Erreur lors du chargement des prestataires');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, selectedCity, searchQuery]);

  // Initial load
  useEffect(() => {
    loadProviders();
  }, [selectedCategory, selectedCity]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      loadProviders();
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  // Handle refresh
  const handleRefresh = () => {
    loadProviders(true);
  };

  // Handle provider press
  const handleProviderPress = (slug: string) => {
    router.push(`/(client)/provider/${slug}`);
  };

  // Handle search submit
  const handleSearchSubmit = () => {
    loadProviders();
  };

  // Render provider item
  const renderProvider = ({ item }: { item: ProviderDisplay }) => (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <ProviderCard
        photoURL={item.photoURL}
        businessName={item.businessName}
        category={item.category}
        city={item.city}
        rating={item.rating}
        minPrice={item.minPrice}
        onPress={() => handleProviderPress(item.slug)}
      />
    </View>
  );

  // Render header (search + filters)
  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: colors.background }]}>
      {/* Search Bar */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher un prestataire..."
          onSubmit={handleSearchSubmit}
        />
      </View>

      {/* Category Pills */}
      <View style={{ marginTop: spacing.md }}>
        <CategoryPills
          categories={categories}
          selectedId={selectedCategory}
          onSelect={setSelectedCategory}
          showAll
        />
      </View>

      {/* City Select */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.md }}>
        <CitySelect
          value={selectedCity}
          cities={cities}
          onChange={setSelectedCity}
        />
      </View>

      {/* Results count */}
      {!loading && !error && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
          <Text variant="caption" color="textSecondary">
            {providers.length} prestataire{providers.length !== 1 ? 's' : ''} trouvé{providers.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}
    </View>
  );

  // Render empty state
  const renderEmpty = () => {
    if (loading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Erreur"
            description={error}
            actionLabel="Réessayer"
            onAction={() => loadProviders()}
          />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="search-outline"
          title="Aucun résultat"
          description="Essayez de modifier vos critères de recherche"
          actionLabel="Effacer les filtres"
          onAction={() => {
            setSearchQuery('');
            setSelectedCategory(null);
            setSelectedCity(null);
          }}
        />
      </View>
    );
  };

  // Render loading
  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="body" color="textSecondary" style={{ marginTop: spacing.md }}>
        Chargement...
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={loading && !refreshing ? [] : providers}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={loading && !refreshing ? renderLoading : renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={
          providers.length === 0 && !loading
            ? styles.emptyListContent
            : { paddingBottom: spacing['3xl'] }
        }
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      />
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  emptyListContent: {
    flexGrow: 1,
  },
});
