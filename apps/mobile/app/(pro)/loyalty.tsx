/**
 * Loyalty Management Screen (pro)
 *
 * THE page for the pro's loyalty program — moved off the home tab
 * (the dashboard now only shows a compact entry card). Three states:
 *   - no plan access      → upsell card routing to the paywall
 *                           (same copy as the services.tsx block)
 *   - access, no program  → invitation card routing to /pro/services
 *                           where the settings sheet lives
 *   - program active      → program summary (reward + eligible
 *                           services + edit), two stat tiles, and the
 *                           FULL list of clients with a started card
 *                           (armed first, then closest to the reward).
 */

import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { WithId } from '@booking-app/firebase';
import {
  hasLoyaltyAccess,
  isLoyaltyConfigValid,
  isLoyaltyRewardArmed,
  loyaltyRemaining,
  type ProviderClient,
} from '@booking-app/shared';
import { useTheme } from '../../theme';
import { Avatar, Badge, Card, EmptyState, Loader, Text } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useProvider } from '../../contexts';
import { useProviderClients, useServices } from '../../hooks';

function formatPrice(cents: number): string {
  const euros = cents / 100;
  return euros % 1 === 0 ? `${euros} €` : `${euros.toFixed(2)} €`;
}

/** Thin progress bar — same visual contract as MyProvidersRow's
 *  MiniGauge (fixed height so every row has the same size). */
function MiniGauge({ filled, threshold }: { filled: number; threshold: number }) {
  const { colors } = useTheme();
  const pct = threshold > 0 ? Math.min(100, Math.round((filled / threshold) * 100)) : 0;
  return (
    <View style={[styles.gaugeTrack, { backgroundColor: colors.border }]}>
      <View
        style={[
          styles.gaugeFill,
          { width: `${pct}%`, backgroundColor: colors.primary },
        ]}
      />
    </View>
  );
}

/** Small stat tile — count + label, used for the 2-column row. */
function StatTile({
  icon,
  value,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tint: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        padding: spacing.md,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: tint + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.sm,
        }}
      >
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text variant="h3" style={{ fontWeight: '800' }}>{value}</Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function LoyaltyScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { provider, providerId, refreshProvider } = useProvider();

  const loyaltySettings = provider?.settings?.loyalty ?? null;
  const loyaltyAccess = hasLoyaltyAccess(provider);
  const loyaltyActive = loyaltyAccess && isLoyaltyConfigValid(loyaltySettings);

  // Same dataset as the home tab & /pro/clients — the loyalty
  // counter lives on each providerClients doc.
  const { clients, loading, refresh } = useProviderClients(
    loyaltyActive ? providerId ?? undefined : undefined,
  );
  // Active services — only needed to phrase the "N of M eligible
  // services" line of the summary card.
  const { services } = useServices(loyaltyActive ? providerId ?? undefined : undefined);

  const threshold = loyaltySettings?.threshold ?? 0;

  // Clients with a started card, armed first then closest to the
  // reward (armed → remaining === 0, so one ascending sort does it).
  const { rows, inProgressCount, readyCount } = useMemo(() => {
    const withCards = clients.filter((c) => (c.loyaltyConfirmedCount ?? 0) > 0);
    const ready = withCards.filter((c) =>
      isLoyaltyRewardArmed(c.loyaltyConfirmedCount ?? 0, threshold),
    ).length;
    const sorted = [...withCards].sort(
      (a, b) =>
        loyaltyRemaining(a.loyaltyConfirmedCount ?? 0, threshold) -
        loyaltyRemaining(b.loyaltyConfirmedCount ?? 0, threshold),
    );
    return { rows: sorted, inProgressCount: withCards.length, readyCount: ready };
  }, [clients, threshold]);

  const handleRefresh = async () => {
    await Promise.all([refresh(), refreshProvider()]);
  };

  // -- Eligible services line -------------------------------------------------
  const eligibleLine = useMemo(() => {
    if (!loyaltySettings) return '';
    const excluded = loyaltySettings.excludedServiceIds ?? [];
    const total = services.length;
    const eligible = services.filter((s) => !excluded.includes(s.id)).length;
    if (total === 0 || eligible >= total) return t('proLoyaltyPage.eligibleAll');
    return t('proLoyaltyPage.eligibleSome', { count: eligible, total });
  }, [loyaltySettings, services, t]);

  const rewardLine = loyaltySettings
    ? loyaltySettings.rewardType === 'percent'
      ? t('proLoyalty.card.activeSummaryPercent', {
          percent: loyaltySettings.rewardValue,
          threshold: loyaltySettings.threshold,
        })
      : t('proLoyalty.card.activeSummaryAmount', {
          amount: formatPrice(loyaltySettings.rewardValue),
          threshold: loyaltySettings.threshold,
        })
    : '';

  // -- Render: gate KO — upsell to the paywall --------------------------------
  if (!loyaltyAccess) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BrandedHeader title={t('proLoyaltyPage.title')} />
        <View style={{ padding: spacing.lg }}>
          <Pressable
            onPress={() => router.push('/(pro)/paywall' as any)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.md,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="lock-closed" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                {t('proLoyalty.card.title')}
              </Text>
              <Text variant="caption" color="textSecondary" style={{ marginTop: 1 }}>
                {t('proLoyalty.card.lockedSummary')}
              </Text>
            </View>
            <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
              {t('proLoyalty.card.unlock')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // -- Render: access OK but no active program — invitation -------------------
  if (!loyaltyActive || !loyaltySettings) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BrandedHeader title={t('proLoyaltyPage.title')} />
        <View style={{ padding: spacing.lg }}>
          <Card padding="lg" shadow="sm">
            <View style={{ alignItems: 'center' }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: colors.primaryLight,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: spacing.md,
                }}
              >
                <Ionicons name="gift-outline" size={28} color={colors.primary} />
              </View>
              <Text variant="h3" style={{ textAlign: 'center' }}>
                {t('proHome.loyalty.inviteTitle')}
              </Text>
              <Text
                variant="bodySmall"
                color="textSecondary"
                style={{ textAlign: 'center', marginTop: spacing.xs }}
              >
                {t('proHome.loyalty.inviteSubtitle')}
              </Text>
              <Pressable
                onPress={() => router.push('/(pro)/services')}
                style={({ pressed }) => ({
                  marginTop: spacing.lg,
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.xl,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text variant="bodySmall" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                  {t('proLoyalty.card.configure')}
                </Text>
              </Pressable>
            </View>
          </Card>
        </View>
      </View>
    );
  }

  // -- Render: program active -------------------------------------------------
  const renderClient = ({ item, index }: { item: WithId<ProviderClient>; index: number }) => {
    const count = item.loyaltyConfirmedCount ?? 0;
    const armed = isLoyaltyRewardArmed(count, threshold);
    const remaining = loyaltyRemaining(count, threshold);
    const name = item.name || t('proClients.unnamedClient');
    return (
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(pro)/client-detail/[key]',
            params: { key: item.clientKey },
          } as any)
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
          borderTopWidth: index === 0 ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        })}
      >
        <Avatar imageUrl={item.photoURL || undefined} name={name} size="sm" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodySmall" style={{ fontWeight: '500' }} numberOfLines={1}>
            {name}
          </Text>
          <MiniGauge filled={armed ? threshold : count % threshold} threshold={threshold} />
        </View>
        {armed ? (
          <Badge label={t('proLoyaltyPage.ready')} variant="success" size="sm" />
        ) : (
          <Text variant="caption" color="textMuted">
            {t('proLoyaltyPage.remaining', { count: remaining })}
          </Text>
        )}
        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <BrandedHeader title={t('proLoyaltyPage.title')} />

      {loading && clients.length === 0 ? (
        <View style={styles.center}>
          <Loader />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.clientKey}
          renderItem={renderClient}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
          contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
          ListHeaderComponent={
            <View style={{ padding: spacing.lg, paddingBottom: spacing.md }}>
              {/* Program summary */}
              <Card padding="md" shadow="sm">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: colors.primaryLight,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="gift-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="body" style={{ fontWeight: '700' }} numberOfLines={1}>
                      {rewardLine}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={{ marginTop: 1 }}>
                      {eligibleLine}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/(pro)/services')}
                    hitSlop={8}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
                      {t('proLoyaltyPage.edit')}
                    </Text>
                  </Pressable>
                </View>
              </Card>

              {/* Stats row */}
              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <StatTile
                  icon="albums-outline"
                  value={inProgressCount}
                  label={t('proLoyaltyPage.statsInProgress')}
                  tint={colors.primary}
                />
                <StatTile
                  icon="ribbon-outline"
                  value={readyCount}
                  label={t('proLoyaltyPage.statsReady')}
                  tint={colors.success}
                />
              </View>

              {/* List title */}
              {rows.length > 0 && (
                <Text variant="h3" style={{ marginTop: spacing.lg }}>
                  {t('proLoyaltyPage.listTitle')}
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="gift-outline"
              title={t('proLoyaltyPage.empty.title')}
              description={t('proLoyaltyPage.empty.description')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeTrack: {
    width: 110,
    height: 5,
    borderRadius: 2.5,
    marginTop: 5,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 2.5,
  },
});
