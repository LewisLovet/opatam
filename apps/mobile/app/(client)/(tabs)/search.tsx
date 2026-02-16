/**
 * Search Tab Screen
 * Progressive search: Region (mandatory) → City → Category
 * User must select a region first (via GPS or manual pick) before seeing results
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Keyboard,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../theme';
import {
  Text,
  SearchBar,
  CitySelect,
  RegionSelect,
  CategorySelect,
  ProviderCard,
  ProviderCardSkeleton,
  EmptyState,
} from '../../../components';
import { useProviders, useNavigateToProvider, useUserLocation } from '../../../hooks';
import {
  REGIONS,
  REGION_NAMES,
  CATEGORIES,
  getCityRegion,
  getRegionFromCoords,
} from '@booking-app/shared';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

const PAGE_SIZE = 10;
const MAX_BROWSE_RESULTS = 100;

// Map CATEGORIES constant to the format CategorySelect expects
const categoryOptions = CATEGORIES.map((c) => ({ id: c.id, label: c.label }));

export default function SearchScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { navigateToProvider, isLoading } = useNavigateToProvider();

  // User location
  const { location: userLocation, loading: locationLoading, refresh: refreshLocation } = useUserLocation();

  // Search state — progressive: Region (mandatory first pick) → City → Category
  // hasPickedRegion distinguishes "never interacted" from "chose Toutes les régions"
  const [hasPickedRegion, setHasPickedRegion] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.category || null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Sync category from navigation params (e.g. home page category tap)
  useEffect(() => {
    if (params.category) {
      setSelectedCategory(params.category);
      if (!hasPickedRegion) {
        setHasPickedRegion(true);
      }
    }
  }, [params.category]);
  const [gpsDetecting, setGpsDetecting] = useState(false);

  // Handle "Use my location" button
  const handleUseLocation = useCallback(async () => {
    if (userLocation) {
      // Location already available — detect region
      let region: string | null = null;
      if (userLocation.city) {
        region = getCityRegion(userLocation.city);
      }
      if (!region) {
        region = getRegionFromCoords(userLocation.latitude, userLocation.longitude);
      }
      if (region) {
        setSelectedRegion(region);
        setSelectedCity(null);
        setHasPickedRegion(true);
      }
    } else {
      // Request location
      setGpsDetecting(true);
      await refreshLocation();
      setGpsDetecting(false);
    }
  }, [userLocation, refreshLocation]);

  // When location becomes available after GPS request, auto-detect region
  useEffect(() => {
    if (gpsDetecting && !locationLoading && userLocation) {
      setGpsDetecting(false);
      let region: string | null = null;
      if (userLocation.city) {
        region = getCityRegion(userLocation.city);
      }
      if (!region) {
        region = getRegionFromCoords(userLocation.latitude, userLocation.longitude);
      }
      if (region) {
        setSelectedRegion(region);
        setSelectedCity(null);
        setHasPickedRegion(true);
      }
    }
  }, [gpsDetecting, locationLoading, userLocation]);

  // Build cities list based on selected region
  const cities = React.useMemo(() => {
    if (selectedRegion && REGIONS[selectedRegion]) {
      return REGIONS[selectedRegion];
    }
    return [];
  }, [selectedRegion]);

  // When region changes, reset city
  const handleRegionChange = useCallback((region: string | null) => {
    setSelectedRegion(region);
    setSelectedCity(null);
    setHasPickedRegion(true);
  }, []);

  // Debounced query for API calls
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Fetch once the user has made their first region choice
  // Text search (3+ chars): no cap. Browsing: cap at 100 results.
  const hasTextSearch = debouncedQuery.length >= 3;
  const { providers, loading, loadingMore, hasMore, error, refresh, loadMore } = useProviders(
    hasPickedRegion
      ? {
          region: selectedRegion,
          city: selectedCity,
          category: selectedCategory,
          query: debouncedQuery || null,
          pageSize: PAGE_SIZE,
          maxResults: hasTextSearch ? undefined : MAX_BROWSE_RESULTS,
        }
      : { pageSize: 0 } // Won't trigger a fetch
  );

  // Handle refresh
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (!hasPickedRegion) return;
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Handle search submit
  const handleSearchSubmit = () => {
    setDebouncedQuery(searchQuery);
    Keyboard.dismiss();
  };

  // Memoized render for provider card
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

  // Handle end reached for infinite scroll
  const handleEndReached = useCallback(() => {
    if (!loading && !loadingMore && hasMore) {
      loadMore();
    }
  }, [loading, loadingMore, hasMore, loadMore]);

  // Render empty state (only when region is selected)
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
            setSelectedCity(null);
            setSelectedCategory(null);
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

  // Render refinement filters
  const renderFilters = () => (
    <View style={[styles.filtersContainer, { backgroundColor: colors.background }]}>
      {/* Active region with change button */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.sm }}>
        <RegionSelect
          value={selectedRegion}
          regions={REGION_NAMES}
          onChange={handleRegionChange}
        />
      </View>

      {/* City Select (scoped to selected region — hidden when "Toutes les régions") */}
      {selectedRegion && (
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          <CitySelect
            value={selectedCity}
            cities={cities}
            onChange={setSelectedCity}
          />
        </View>
      )}

      {/* Category Select (full list modal) */}
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        <CategorySelect
          value={selectedCategory}
          categories={categoryOptions}
          onChange={setSelectedCategory}
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

  // Render footer
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  };

  // =============================================
  // FIRST VISIT — show region selection screen
  // =============================================
  if (!hasPickedRegion) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ── Branded Header ── */}
        <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="h2" style={{ color: '#FFFFFF' }}>Recherche</Text>
          </View>
        </View>
        <View style={[styles.regionPickerContainer, { paddingHorizontal: spacing.lg }]}>
          {/* Title */}
          <View style={{ alignItems: 'center', marginTop: spacing['2xl'], marginBottom: spacing.xl }}>
            <Ionicons name="search" size={48} color={colors.primary} style={{ marginBottom: spacing.md }} />
            <Text variant="h2" style={{ textAlign: 'center', marginBottom: spacing.sm }}>
              Rechercher un prestataire
            </Text>
            <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
              Commencez par choisir votre région
            </Text>
          </View>

          {/* Use my location button */}
          <Pressable
            onPress={handleUseLocation}
            disabled={gpsDetecting || locationLoading}
            style={({ pressed }) => [
              styles.locationButton,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                marginBottom: spacing.lg,
                opacity: (gpsDetecting || locationLoading) ? 0.6 : 1,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            {gpsDetecting || locationLoading ? (
              <ActivityIndicator size="small" color="#fff" style={{ marginRight: spacing.sm }} />
            ) : (
              <Ionicons name="navigate" size={20} color="#fff" style={{ marginRight: spacing.sm }} />
            )}
            <Text variant="body" style={{ color: '#fff', fontWeight: '600' }}>
              Utiliser ma localisation
            </Text>
          </Pressable>

          {/* Divider with "ou" */}
          <View style={[styles.dividerRow, { marginBottom: spacing.lg }]}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text variant="caption" color="textMuted" style={{ marginHorizontal: spacing.md }}>
              ou
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Region select */}
          <RegionSelect
            value={selectedRegion}
            regions={REGION_NAMES}
            onChange={handleRegionChange}
            placeholder="Choisir une région"
          />
        </View>
      </View>
    );
  }

  // =============================================
  // REGION SELECTED — show results with filters
  // =============================================
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ── */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md }}>
          <Text variant="h2" style={{ color: '#FFFFFF' }}>Recherche</Text>
        </View>
      </View>

      {/* Search Bar */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  regionPickerContainer: {
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
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
