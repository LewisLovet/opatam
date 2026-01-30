/**
 * Provider Detail Screen
 * Full provider profile with services, reviews, and booking CTA
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import {
  Text,
  Card,
  Skeleton,
  ProviderHeader,
  ProviderHeaderSkeleton,
  ProviderInfo,
  ServiceCategory,
  RatingStats,
  ReviewCard,
  StickyFooter,
  Button,
  EmptyState,
  useToast,
} from '../../../components';
import { useProvider, useServices, useReviews, useLocations, useNextAvailableDate } from '../../../hooks';
import type { Service } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

// Group services (Service type doesn't have category, so we group all together)
function groupServices(services: WithId<Service>[]): { title: string; services: WithId<Service>[] }[] {
  if (services.length === 0) return [];

  return [{
    title: 'Prestations',
    services,
  }];
}

export default function ProviderDetailScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  // Fetch provider data
  const { provider, loading: loadingProvider, error: providerError, refresh: refreshProvider } = useProvider(slug);

  // Fetch related data (only when provider is loaded)
  const { services, loading: loadingServices, refresh: refreshServices } = useServices(provider?.id);
  const { reviews, loading: loadingReviews, refresh: refreshReviews } = useReviews(provider?.id);
  const { locations, refresh: refreshLocations } = useLocations(provider?.id);
  const { formattedDate: nextAvailableFormatted, loading: loadingAvailability, refresh: refreshAvailability } = useNextAvailableDate(provider?.id);

  // Selected service state
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshProvider(),
      refreshServices(),
      refreshReviews(),
      refreshLocations(),
      refreshAvailability(),
    ]);
    setRefreshing(false);
  };

  // Handle service selection
  const handleSelectService = (serviceId: string | null) => {
    setSelectedServiceId(serviceId);
  };

  // Handle booking
  const handleBooking = () => {
    if (!selectedServiceId) {
      showToast({
        variant: 'warning',
        message: 'Sélectionnez une prestation',
      });
      return;
    }

    if (!provider) return;

    // Navigate to booking flow with provider and service
    router.push({
      pathname: '/(client)/booking/[providerId]',
      params: {
        providerId: provider.id,
        serviceId: selectedServiceId,
      },
    });
  };

  // Get primary location for display
  const primaryLocation = locations[0];

  // Group services
  const serviceCategories = groupServices(services);

  // Get selected service
  const selectedService = services.find((s) => s.id === selectedServiceId);

  // Loading state - show skeleton while data is loading
  if (loadingProvider) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Floating Back Button - positioned in safe area over image */}
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backButton,
            {
              top: insets.top + 10,
              backgroundColor: 'rgba(255,255,255,0.9)',
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header skeleton */}
          <ProviderHeaderSkeleton />

          {/* Provider Info skeleton */}
          <View style={{ padding: spacing.lg }}>
            <Card padding="md" shadow="sm">
              <View style={{ gap: spacing.sm }}>
                <Skeleton width="100%" height={16} />
                <Skeleton width="90%" height={16} />
                <Skeleton width="60%" height={14} style={{ marginTop: spacing.xs }} />
              </View>
            </Card>
          </View>

          {/* Services skeleton */}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Skeleton width={120} height={24} style={{ marginBottom: spacing.md }} />
            <Card padding="md" shadow="sm">
              {[1, 2, 3].map((i) => (
                <View key={i} style={{ marginBottom: i < 3 ? spacing.md : 0 }}>
                  <Skeleton width="70%" height={18} />
                  <Skeleton width="50%" height={14} style={{ marginTop: spacing.xs }} />
                  <Skeleton width="30%" height={14} style={{ marginTop: spacing.xs }} />
                </View>
              ))}
            </Card>
          </View>

          {/* Reviews skeleton */}
          <View style={{ padding: spacing.lg }}>
            <Skeleton width={60} height={24} style={{ marginBottom: spacing.md }} />
            <Card padding="lg" shadow="sm">
              <View style={{ alignItems: 'center', gap: spacing.sm }}>
                <Skeleton width={80} height={32} />
                <Skeleton width={120} height={16} />
              </View>
            </Card>
          </View>
        </ScrollView>
      </View>
    );
  }

  // Error state
  if (providerError || !provider) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        {/* Back button for error state */}
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backButton,
            {
              top: insets.top + 10,
              backgroundColor: colors.surface,
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <EmptyState
          icon="alert-circle-outline"
          title="Erreur"
          description={providerError || 'Prestataire non trouvé'}
          actionLabel="Retour"
          onAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Floating Back Button - positioned in safe area over image */}
      <Pressable
        onPress={() => router.back()}
        style={[
          styles.backButton,
          {
            top: insets.top + 10,
            backgroundColor: 'rgba(255,255,255,0.9)',
            borderRadius: radius.full,
          },
        ]}
      >
        <Ionicons name="chevron-back" size={24} color={colors.text} />
      </Pressable>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* Provider Header */}
        <ProviderHeader
          coverPhotoURL={provider.coverPhotoURL}
          avatarURL={provider.photoURL}
          businessName={provider.businessName}
          category={provider.category}
          rating={provider.rating}
        />

        {/* Provider Info */}
        <View style={{ padding: spacing.lg }}>
          <Card padding="md" shadow="sm">
            <ProviderInfo
              description={provider.description}
              address={primaryLocation?.address || ''}
              city={primaryLocation ? `${primaryLocation.city} ${primaryLocation.postalCode}` : provider.cities[0] || ''}
              phone={null}
            />
          </Card>

          {/* Next Available Date Badge */}
          {!loadingAvailability && nextAvailableFormatted && (
            <View style={[styles.availabilityBadge, { backgroundColor: colors.primaryLight || '#e4effa', marginTop: spacing.md }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: spacing.xs }} />
              <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
                Prochaine dispo : {nextAvailableFormatted}
              </Text>
            </View>
          )}
        </View>

        {/* Services */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text variant="h2" style={{ marginBottom: spacing.md }}>
            Prestations
          </Text>
          {loadingServices ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : services.length === 0 ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="cut-outline"
                title="Aucune prestation"
                description="Ce prestataire n'a pas encore de prestations"
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.lg }}>
              {serviceCategories.map((category, index) => (
                <ServiceCategory
                  key={index}
                  title={category.title}
                  services={category.services.map((s) => ({
                    id: s.id,
                    name: s.name,
                    description: s.description,
                    duration: s.duration,
                    price: s.price / 100, // Convert cents to euros
                  }))}
                  selectedId={selectedServiceId}
                  onSelectService={handleSelectService}
                  collapsible
                  defaultExpanded={index === 0}
                />
              ))}
            </View>
          )}
        </View>

        {/* Reviews */}
        <View style={{ padding: spacing.lg }}>
          <Text variant="h2" style={{ marginBottom: spacing.md }}>
            Avis
          </Text>

          {/* Rating Stats */}
          {provider.rating.count > 0 && (
            <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.lg }}>
              <RatingStats
                average={provider.rating.average}
                count={provider.rating.count}
                distribution={provider.rating.distribution}
              />
            </Card>
          )}

          {/* Reviews List */}
          {loadingReviews ? (
            <View style={styles.sectionLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : reviews.length === 0 ? (
            <Card padding="lg" shadow="sm">
              <EmptyState
                icon="chatbubble-outline"
                title="Aucun avis"
                description="Ce prestataire n'a pas encore d'avis"
              />
            </Card>
          ) : (
            <View style={{ gap: spacing.md }}>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  authorName={review.clientName}
                  rating={review.rating}
                  comment={review.comment}
                  date={review.createdAt}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Footer */}
      <StickyFooter>
        <View style={styles.footerContent}>
          {selectedService && (
            <View style={{ marginBottom: spacing.sm }}>
              <Text variant="caption" color="textSecondary">
                {selectedService.name} - {selectedService.duration} min
              </Text>
              <Text variant="h3" color="primary">
                {(selectedService.price / 100).toFixed(2)} €
              </Text>
            </View>
          )}
          <Button
            variant="primary"
            title={selectedService ? 'Réserver' : 'Sélectionnez une prestation'}
            onPress={handleBooking}
            disabled={!selectedServiceId}
          />
        </View>
      </StickyFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sectionLoading: {
    padding: 40,
    alignItems: 'center',
  },
  footerContent: {
    // Dynamic styles
  },
  availabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
});
