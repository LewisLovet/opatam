/**
 * Booking Step 1: Member Selection
 * Allows user to select a team member for their appointment
 */

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme';
import { Text, Card, EmptyState, ServiceCategory, useToast } from '../../../../components';
import { useBooking } from '../../../../contexts';
import { useProviderById, useServices, useServiceCategories, useMembers, useLocations } from '../../../../hooks';
import {
  computeDiscountedTotal,
  getDiscountedMinPrice,
  resolveServiceDiscount,
  getDiscountDaysLeft,
  formatPromoCountdown,
  PROMO_URGENCY_DAYS,
  serviceHasChoices,
} from '@booking-app/shared';
import type { Member, Service } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { ServiceChoicesPreview } from '../../../../components/business/ServiceChoicesPreview';
import { BookingStepHeader } from '../../../../components/business/BookingStepHeader';

export default function MemberSelectionScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { providerId, serviceId } = useLocalSearchParams<{ providerId: string; serviceId: string }>();

  // Booking context
  const {
    initBooking,
    addToCart,
    removeFromCart,
    setMember,
    cart,
  } = useBooking();

  // Fetch data - use useProviderById since we have the ID, not the slug
  const { provider, loading: loadingProvider, error: providerError } = useProviderById(providerId);
  const { services, loading: loadingServices } = useServices(providerId);
  const { categories } = useServiceCategories(providerId);
  const { members, loading: loadingMembers, error: membersError } = useMembers(providerId);
  const { locations } = useLocations(providerId);

  // Service awaiting its variation/option choices (picker overlay).
  const [pendingChoiceService, setPendingChoiceService] = useState<WithId<Service> | null>(null);
  // "Ajouter une prestation" modal (provider's full service list).
  const [showServicePicker, setShowServicePicker] = useState(false);

  // Add a service to the cart — open its choices picker first when it has any.
  const handleAddService = useCallback(
    (s: WithId<Service>) => {
      setShowServicePicker(false);
      if (serviceHasChoices(s)) setPendingChoiceService(s);
      else addToCart(s);
    },
    [addToCart],
  );

  // Initialise the provider + seed the cart with the deep-linked first service.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !provider || services.length === 0) return;
    initBooking(provider); // fresh: provider + empty cart
    const first = serviceId ? services.find((s) => s.id === serviceId) : undefined;
    if (first) {
      if (serviceHasChoices(first)) setPendingChoiceService(first);
      else addToCart(first);
    }
    setSeeded(true);
  }, [seeded, provider, services, serviceId, initBooking, addToCart]);

  // Loading state
  const isLoading = loadingProvider || loadingServices || loadingMembers;

  // Cart total price (effective, in cents).
  // Shop-wide promo applied to services without their own discount.
  const globalDiscount = provider?.settings?.globalDiscount ?? null;

  const cartTotalPrice = useMemo(
    () =>
      cart.reduce(
        (sum, c) => sum + computeDiscountedTotal(c.service, c.selections, globalDiscount).price,
        0,
      ),
    [cart, globalDiscount],
  );
  const cartTotalOriginal = useMemo(
    () =>
      cart.reduce(
        (sum, c) => sum + computeDiscountedTotal(c.service, c.selections, globalDiscount).original,
        0,
      ),
    [cart, globalDiscount],
  );
  const cartHasPromo = cartTotalOriginal > cartTotalPrice;

  // Proceed to date for the chosen member.
  const handleSelectMember = (member: WithId<Member>) => {
    if (cart.length === 0) {
      showToast({ variant: 'warning', message: 'Ajoutez au moins une prestation' });
      return;
    }
    setMember(member);
    router.push(`/(client)/booking/${providerId}/date`);
  };

  // Get location name for a member
  const getMemberLocation = (member: WithId<Member>): string => {
    const location = locations.find((l) => l.id === member.locationId);
    return location ? `${location.name} - ${location.city}` : '';
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading view
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BookingStepHeader title="Choisir un membre" onBack={() => router.back()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Error view
  if (providerError || membersError || !provider) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BookingStepHeader title="Choisir un membre" onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Erreur"
            description={providerError || membersError || 'Données non trouvées'}
            actionLabel="Retour"
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  // ── Choices step: the client picks a prestation's variations / options ──
  if (pendingChoiceService) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BookingStepHeader
          title={pendingChoiceService.name}
          onBack={() => setPendingChoiceService(null)}
        />
        <ServiceChoicesPreview
          mode="picker"
          confirmLabel="Ajouter"
          safeAreaBottom
          discount={resolveServiceDiscount(pendingChoiceService, globalDiscount)}
          onConfirm={(sel) => {
            addToCart(pendingChoiceService, sel);
            setPendingChoiceService(null);
          }}
          service={{
            name: pendingChoiceService.name,
            price: pendingChoiceService.price,
            duration: pendingChoiceService.duration,
            photoURL: pendingChoiceService.photoURL,
            variations: pendingChoiceService.variations ?? [],
            options: pendingChoiceService.options ?? [],
            infoFields: pendingChoiceService.infoFields ?? [],
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <BookingStepHeader title="Votre réservation" onBack={() => router.back()} />

      {/* Cart — the prestations booked in this visit */}
      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        <Card padding="md" shadow="sm">
          {cart.length === 0 ? (
            <Text variant="bodySmall" color="textSecondary">
              Aucune prestation sélectionnée.
            </Text>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {cart.map((item, idx) => {
                const eff = computeDiscountedTotal(item.service, item.selections, globalDiscount);
                const itemHasPromo = eff.discountPercent != null && eff.original > eff.price;
                return (
                  <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                        {item.service.name}
                      </Text>
                      <Text variant="caption" color="textSecondary">
                        {eff.duration} min ·{' '}
                        {itemHasPromo ? (
                          <Text variant="caption">
                            <Text
                              variant="caption"
                              style={{ textDecorationLine: 'line-through', color: colors.textMuted }}
                            >
                              {(eff.original / 100).toFixed(2)} €
                            </Text>
                            <Text variant="caption" style={{ color: '#E11D48', fontWeight: '600' }}>
                              {'  '}
                              {(eff.price / 100).toFixed(2)} €
                            </Text>
                          </Text>
                        ) : (
                          `${(eff.price / 100).toFixed(2)} €`
                        )}
                      </Text>
                    </View>
                    <Pressable onPress={() => removeFromCart(idx)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
                      <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={() => setShowServicePicker(true)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              marginTop: cart.length ? spacing.md : spacing.sm,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.primary,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
              Ajouter une prestation
            </Text>
          </Pressable>

          {cart.length > 1 && (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginTop: spacing.md,
                paddingTop: spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Text variant="body" style={{ fontWeight: '700' }}>Total</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                {cartHasPromo && (
                  <Text
                    variant="bodySmall"
                    style={{ textDecorationLine: 'line-through', color: colors.textMuted }}
                  >
                    {(cartTotalOriginal / 100).toFixed(2)} €
                  </Text>
                )}
                <Text
                  variant="body"
                  style={{ fontWeight: '700', color: cartHasPromo ? '#E11D48' : colors.primary }}
                >
                  {(cartTotalPrice / 100).toFixed(2)} €
                </Text>
              </View>
            </View>
          )}
        </Card>
      </View>

      {/* Members list */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.md, marginTop: spacing.lg }}>
          Sélectionnez la personne qui réalisera votre prestation
        </Text>

        {members.length === 0 ? (
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="people-outline"
              title="Aucun membre disponible"
              description="Ce prestataire n'a pas encore de membres d'équipe"
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                onPress={() => handleSelectMember(member)}
                style={({ pressed }) => [
                  styles.memberCard,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                {/* Avatar */}
                {member.photoURL ? (
                  <Image
                    source={{ uri: member.photoURL }}
                    style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      {getInitials(member.name)}
                    </Text>
                  </View>
                )}

                {/* Member info */}
                <View style={styles.memberInfo}>
                  <Text variant="body" style={{ fontWeight: '600' }}>
                    {member.name}
                  </Text>
                  {getMemberLocation(member) && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                      <Text variant="caption" color="textSecondary" style={{ marginLeft: 4 }}>
                        {getMemberLocation(member)}
                      </Text>
                    </View>
                  )}
                  {member.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                      <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
                        Principal
                      </Text>
                    </View>
                  )}
                </View>

                {/* Arrow */}
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Add a prestation: provider's service list ── */}
      <Modal
        visible={showServicePicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowServicePicker(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text variant="h3">Ajouter une prestation</Text>
            <Pressable onPress={() => setShowServicePicker(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
            {(() => {
              const known = new Set(categories.map((c) => c.id));
              const groups: { id: string; title: string; items: WithId<Service>[] }[] = [];
              for (const cat of categories) {
                const items = services.filter((s) => s.categoryId === cat.id);
                if (items.length) groups.push({ id: cat.id, title: cat.name, items });
              }
              const uncat = services.filter((s) => !s.categoryId || !known.has(s.categoryId));
              if (uncat.length) {
                groups.push({
                  id: '__uncat__',
                  title: categories.length ? 'Autres prestations' : 'Prestations',
                  items: uncat,
                });
              }
              return groups.map((g) => (
                <ServiceCategory
                  key={g.id}
                  title={g.title}
                  services={g.items.map((s) => {
                    const md = getDiscountedMinPrice(s, globalDiscount);
                    const active = resolveServiceDiscount(s, globalDiscount);
                    const hasPromo = md.discountPercent != null && md.price < md.original;
                    const daysLeft = getDiscountDaysLeft(active);
                    const priceFrom =
                      (s.variations?.length ?? 0) > 0 || (s.options?.length ?? 0) > 0;
                    return {
                      id: s.id,
                      name: s.name,
                      description: s.description,
                      photoURL: s.photoURL,
                      duration: s.duration,
                      // Discounted "à partir de" (cheapest reachable combo) — correct
                      // for variation/option services, not just the dropped base.
                      price: md.price / 100,
                      priceMax: hasPromo || priceFrom ? null : s.priceMax ? s.priceMax / 100 : null,
                      originalPrice: hasPromo ? md.original / 100 : null,
                      discountPercent: hasPromo ? md.discountPercent : null,
                      promoCountdown:
                        hasPromo && daysLeft != null && daysLeft <= PROMO_URGENCY_DAYS
                          ? formatPromoCountdown(daysLeft)
                          : null,
                      priceFrom,
                    };
                  })}
                  onSelectService={(id) => {
                    const svc = services.find((s) => s.id === id);
                    if (svc) handleAddService(svc);
                  }}
                  collapsible={groups.length > 1}
                  defaultExpanded
                />
              ));
            })()}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  serviceInfo: {
    // Dynamic
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
});
