/**
 * Provider Detail Screen
 * Full provider profile with tabbed layout: Prestations, Avis, Infos
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import {
  Text,
  Card,
  Skeleton,
  ExpandableText,
  ProviderHeader,
  ProviderHeaderSkeleton,
  ServiceCategory,
  RatingStats,
  ReviewCard,
  StickyFooter,
  Button,
  EmptyState,
  SocialLinks,
  PortfolioGallery,
  HoursSection,
  TeamSection,
  LocationSection,
  useToast,
} from '../../../components';
import {
  useProvider,
  useServices,
  useServiceCategories,
  useReviews,
  useLocations,
  useNextAvailableDate,
  useTeamAvailabilities,
  useOpeningHours,
  useMembers,
} from '../../../hooks';
import type { Service, ServiceCategory as ServiceCategoryType, SocialLinks as SocialLinksType } from '@booking-app/shared';
import { analyticsService, type WithId } from '@booking-app/firebase';

type TabId = 'prestations' | 'avis' | 'infos';

const TABS: { id: TabId; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'prestations', label: 'Prestations', icon: 'pricetag-outline' },
  { id: 'avis', label: 'Avis', icon: 'star-outline' },
  { id: 'infos', label: 'Infos', icon: 'information-circle-outline' },
];

// Check if provider has any social links
function hasSocialLinks(socialLinks: SocialLinksType): boolean {
  return !!(socialLinks.instagram || socialLinks.facebook || socialLinks.tiktok || socialLinks.website);
}

// Group services by category
function groupServices(
  services: WithId<Service>[],
  categories: WithId<ServiceCategoryType>[],
): { id: string; title: string; services: WithId<Service>[] }[] {
  if (services.length === 0) return [];

  // No categories → flat list
  if (categories.length === 0) {
    return [{ id: '__all__', title: 'Prestations', services }];
  }

  const groups: { id: string; title: string; services: WithId<Service>[] }[] = [];

  for (const cat of categories) {
    const catServices = services.filter((s) => s.categoryId === cat.id);
    if (catServices.length > 0) {
      groups.push({ id: cat.id, title: cat.name, services: catServices });
    }
  }

  // Uncategorized services
  const uncategorized = services.filter(
    (s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId)
  );
  if (uncategorized.length > 0) {
    groups.push({ id: '__other__', title: 'Autres', services: uncategorized });
  }

  return groups;
}

export default function ProviderDetailScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { slug, preview } = useLocalSearchParams<{ slug: string; preview?: string }>();
  const isPreview = preview === '1';
  const router = useRouter();
  const { showToast } = useToast();

  // Fetch provider data
  const { provider, loading: loadingProvider, error: providerError, refresh: refreshProvider } = useProvider(slug);

  // Fetch related data (only when provider is loaded)
  const { services, loading: loadingServices, refresh: refreshServices } = useServices(provider?.id);
  const { categories, refresh: refreshCategories } = useServiceCategories(provider?.id);
  const { reviews, loading: loadingReviews, refresh: refreshReviews } = useReviews(provider?.id);
  const { locations, refresh: refreshLocations } = useLocations(provider?.id);
  const { formattedDate: nextAvailableFormatted, loading: loadingAvailability, refresh: refreshAvailability } = useNextAvailableDate(provider?.id);
  const { weekSchedule, isCurrentlyOpen, loading: loadingHours, refresh: refreshHours } = useOpeningHours(provider?.id);
  const { members, refresh: refreshMembers } = useMembers(provider?.id);

  // Team plan: per-member availability
  const isTeam = provider?.plan === 'team';
  const {
    memberAvailabilities,
    earliestFormattedDate: teamEarliestFormatted,
    loading: loadingTeamAvail,
    refresh: refreshTeamAvail,
  } = useTeamAvailabilities(provider?.id, !!isTeam);

  // For team plans, use the earliest date across all members; for solo, use default hook
  const showTeamDispos = isTeam && memberAvailabilities.length > 1;
  const displayedAvailability = showTeamDispos ? teamEarliestFormatted : nextAvailableFormatted;
  const availabilityLoading = showTeamDispos ? loadingTeamAvail : loadingAvailability;

  // Track page view (once per mount per provider, deduplicated via ref)
  const trackedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!provider?.id || isPreview || trackedRef.current === provider.id) return;
    trackedRef.current = provider.id;
    analyticsService.trackPageView(provider.id).catch(() => {});
  }, [provider?.id, isPreview]);

  // Tab & selection state
  const [activeTab, setActiveTab] = useState<TabId>('prestations');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refreshProvider(),
      refreshServices(),
      refreshCategories(),
      refreshReviews(),
      refreshLocations(),
      refreshAvailability(),
      refreshHours(),
      refreshMembers(),
      ...(isTeam ? [refreshTeamAvail()] : []),
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

  // Group services by category
  const serviceGroups = groupServices(services, categories);

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
            <View style={{ gap: spacing.sm }}>
              <Skeleton width="100%" height={16} />
              <Skeleton width="90%" height={16} />
              <Skeleton width="60%" height={14} style={{ marginTop: spacing.xs }} />
            </View>
          </View>

          {/* Tab bar skeleton */}
          <View style={{ flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', paddingVertical: spacing.sm }}>
                <Skeleton width={80} height={16} />
              </View>
            ))}
          </View>

          {/* Services skeleton */}
          <View style={{ paddingHorizontal: spacing.lg }}>
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
        contentContainerStyle={{ paddingBottom: isPreview ? 40 : 120 }}
      >
        {/* Provider Header */}
        <ProviderHeader
          coverPhotoURL={provider.coverPhotoURL}
          avatarURL={provider.photoURL}
          businessName={provider.businessName}
          category={provider.category}
          rating={provider.rating}
        />

        {/* Description + Availability + Social (above tabs) */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {/* Description */}
          {provider.description && (
            <ExpandableText text={provider.description} numberOfLines={3} />
          )}

          {/* Next Available Date Badge + PayPal */}
          {(!availabilityLoading && displayedAvailability || provider.socialLinks?.paypal) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md, alignItems: 'center' }}>
              {!availabilityLoading && displayedAvailability && (
                <View style={[styles.availabilityBadge, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: spacing.xs }} />
                  <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
                    Prochaine dispo : {displayedAvailability}
                  </Text>
                </View>
              )}
              {provider.socialLinks?.paypal && (
                <Pressable
                  onPress={() => {
                    const url = provider.socialLinks!.paypal!.startsWith('http')
                      ? provider.socialLinks!.paypal!
                      : `https://paypal.me/${provider.socialLinks!.paypal}`;
                    Linking.openURL(url).catch(() => {});
                  }}
                  style={({ pressed }) => [
                    styles.paypalButton,
                    { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
                  ]}
                >
                  <Ionicons name="logo-paypal" size={16} color="white" />
                  <Text variant="caption" style={{ color: 'white', fontWeight: '600' }}>
                    PayPal
                  </Text>
                  <Ionicons name="open-outline" size={12} color="rgba(255,255,255,0.7)" />
                </Pressable>
              )}
            </View>
          )}

          {/* Per-member availability (Team plans) */}
          {showTeamDispos && !loadingTeamAvail && (
            <Card padding="md" shadow="sm" style={{ marginTop: spacing.md }}>
              <Text variant="caption" style={{ fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm }}>
                Disponibilités par professionnel
              </Text>
              <View style={{ gap: spacing.sm }}>
                {memberAvailabilities
                  .filter((ma) => ma.nextDate !== null)
                  .sort((a, b) => a.nextDate!.getTime() - b.nextDate!.getTime())
                  .map((ma) => (
                    <View key={ma.memberId} style={styles.memberRow}>
                      {ma.memberPhoto ? (
                        <Image
                          source={{ uri: ma.memberPhoto }}
                          style={styles.memberAvatar}
                        />
                      ) : (
                        <View style={[styles.memberAvatar, { backgroundColor: colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="person" size={14} color={colors.textSecondary} />
                        </View>
                      )}
                      <Text variant="caption" style={{ flex: 1, fontWeight: '500' }} numberOfLines={1}>
                        {ma.memberName}
                      </Text>
                      <View style={[styles.memberDateBadge, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                        <Text variant="caption" style={{ color: colors.primary, fontWeight: '600', fontSize: 11 }}>
                          {ma.formattedDate}
                        </Text>
                      </View>
                    </View>
                  ))}
              </View>
            </Card>
          )}

          {/* Social Links */}
          {hasSocialLinks(provider.socialLinks) && (
            <View style={{ marginTop: spacing.md }}>
              <SocialLinks links={provider.socialLinks} />
            </View>
          )}
        </View>

        {/* Tab Bar */}
        <View
          style={[
            styles.tabBar,
            {
              marginTop: spacing.lg,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[
                  styles.tab,
                  isActive && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Ionicons
                  name={tab.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  variant="bodySmall"
                  style={{
                    color: isActive ? colors.primary : colors.textSecondary,
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {tab.label}
                </Text>
                {tab.id === 'avis' && reviews.length > 0 && (
                  <View style={[styles.tabBadge, { backgroundColor: isActive ? colors.primary : colors.textMuted }]}>
                    <Text variant="caption" style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>
                      {reviews.length}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Tab Content */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          {/* ─── Prestations Tab ─── */}
          {activeTab === 'prestations' && (
            <View>
              {loadingServices ? (
                <View style={styles.sectionLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : services.length === 0 ? (
                <Card padding="lg" shadow="sm">
                  <EmptyState
                    icon="pricetag-outline"
                    title="Aucune prestation"
                    description="Ce prestataire n'a pas encore de prestations"
                  />
                </Card>
              ) : (
                <View style={{ gap: spacing.lg }}>
                  {serviceGroups.map((group, index) => (
                    <ServiceCategory
                      key={group.id}
                      title={group.title}
                      services={group.services.map((s) => ({
                        id: s.id,
                        name: s.name,
                        description: s.description,
                        duration: s.duration,
                        price: s.price / 100, // Convert cents to euros
                      }))}
                      selectedId={isPreview ? null : selectedServiceId}
                      onSelectService={isPreview ? undefined : handleSelectService}
                      collapsible={serviceGroups.length > 1}
                      defaultExpanded={serviceGroups.length <= 3 || index === 0}
                    />
                  ))}
                </View>
              )}

              {/* Portfolio Gallery */}
              {provider.portfolioPhotos && provider.portfolioPhotos.length > 0 && (
                <View style={{ marginTop: spacing.xl }}>
                  <Text variant="h3" style={{ marginBottom: spacing.md }}>
                    Réalisations
                  </Text>
                  <PortfolioGallery photos={provider.portfolioPhotos} />
                </View>
              )}
            </View>
          )}

          {/* ─── Avis Tab ─── */}
          {activeTab === 'avis' && (
            <View>
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
          )}

          {/* ─── Infos Tab ─── */}
          {activeTab === 'infos' && (
            <View style={{ gap: spacing.xl }}>
              {/* Locations */}
              <LocationSection locations={locations} />

              {/* Opening Hours */}
              {!loadingHours && (
                <HoursSection
                  weekSchedule={weekSchedule}
                  isCurrentlyOpen={isCurrentlyOpen}
                />
              )}

              {/* Team (only for team plans with displayable members) */}
              {isTeam && <TeamSection members={members} />}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Footer (hidden in preview mode) */}
      {!isPreview && (
        <StickyFooter>
          <View style={styles.footerContent}>
            {selectedService && (
              <View style={{ marginBottom: spacing.sm }}>
                <Text variant="caption" color="textSecondary">
                  {selectedService.name} - {selectedService.duration} min
                </Text>
                <Text variant="h3" color="primary">
                  {selectedService.price === 0 ? 'Gratuit' : `${(selectedService.price / 100).toFixed(2)} €`}
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
      )}
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
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  memberDateBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBadge: {
    marginLeft: 6,
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  paypalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0070BA',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
