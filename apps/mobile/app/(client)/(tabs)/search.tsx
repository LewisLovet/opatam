/**
 * Search Tab Screen
 * Search providers with filters and infinite scroll
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../theme';
import {
  Text,
  SearchBar,
  CategoryPills,
  CitySelect,
  ProviderCard,
  ProviderCardSkeleton,
  EmptyState,
} from '../../../components';
import { useProviders, useNavigateToProvider } from '../../../hooks';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

const PAGE_SIZE = 10;

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

export default function SearchScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const { navigateToProvider, isLoading } = useNavigateToProvider();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.category || null
  );
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Debounced query for API calls
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch providers with filters and pagination
  const { providers, loading, loadingMore, hasMore, error, refresh, loadMore } = useProviders({
    category: selectedCategory,
    city: selectedCity,
    query: debouncedQuery || null,
    pageSize: PAGE_SIZE,
  });

  // Handle refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Handle search submit
  const handleSearchSubmit = () => {
    setDebouncedQuery(searchQuery);
    Keyboard.dismiss();
  };

  // Memoized render functions to prevent re-renders
  const renderProvider = useCallback(({ item }: { item: WithId<Provider> }) => (
    <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
      <ProviderCard
        photoURL={item.coverPhotoURL || item.photoURL}
        businessName={item.businessName}
        category={item.category}
        city={item.cities[0] || ''}
        rating={item.rating}
        minPrice={item.minPrice}
        onPress={() => navigateToProvider(item.slug)}
        isLoading={isLoading(item.slug)}
      />
    </View>
  ), [spacing.lg, spacing.md, navigateToProvider, isLoading]);

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
            onAction={refresh}
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
            setDebouncedQuery('');
            setSelectedCategory(null);
            setSelectedCity(null);
          }}
        />
      </View>
    );
  };

  // Render loading skeletons
  const renderLoading = () => (
    <View style={{ paddingHorizontal: spacing.lg }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ marginBottom: spacing.md }}>
          <ProviderCardSkeleton />
        </View>
      ))}
    </View>
  );

  // Render filters (categories, city, results count) - inside FlatList header
  const renderFilters = () => (
    <View style={[styles.filtersContainer, { backgroundColor: colors.background }]}>
      {/* Category Pills */}
      <View style={{ marginTop: spacing.sm }}>
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
            {hasMore && ' (affichage partiel)'}
          </Text>
        </View>
      )}
    </View>
  );

  // Render footer (loading indicator for infinite scroll)
  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      loadMore();
    }
  }, [loading, loadingMore, hasMore, loadMore]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search Bar - Outside FlatList to prevent focus loss on re-render */}
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.background }}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Rechercher un prestataire..."
          onSubmit={handleSearchSubmit}
        />
      </View>

      <FlatList
        data={loading && !refreshing ? [] : providers}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderFilters}
        ListEmptyComponent={loading && !refreshing ? renderLoading : renderEmpty}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        contentContainerStyle={
          providers.length === 0 && !loading
            ? styles.emptyListContent
            : { paddingBottom: spacing['3xl'] }
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filtersContainer: {
    // Dynamic styles applied inline
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
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
