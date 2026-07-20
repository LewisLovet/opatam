/**
 * /pro/clients — provider's CRM-lite (mobile).
 *
 * Mirrors the web /pro/clients page, adapted for touch:
 *   - Search bar, scrollable tag chips, sort sheet
 *   - FlatList of clients with avatar + tags + KPIs
 *   - "Comprendre les tags" sheet — touch UI doesn't have hover
 *     tooltips, so the rules legend is the only path to learn
 *     what each tag means
 *
 * The detail screen (notes, preferences, history, "Nouveau RDV")
 * lives at /pro/client-detail/[key].
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import i18n from '../../lib/i18n';
import { Text, Card, Avatar, Badge } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useProvider } from '../../contexts';
import { useProviderClients } from '../../hooks';
import {
  hasLoyaltyAccess,
  isLoyaltyConfigValid,
  isLoyaltyRewardArmed,
  type ProviderClient,
  type ProviderClientTag,
} from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import {
  TAG_META,
  TAG_META_BY_VALUE,
  formatRevenue,
} from '../../components/business/Clients/tagMeta';

type SortKey =
  | 'lastBooking-desc'
  | 'lastBooking-asc'
  | 'name-asc'
  | 'revenue-desc'
  | 'bookings-desc';

const SORT_OPTIONS: { value: SortKey; labelKey: string }[] = [
  { value: 'lastBooking-desc', labelKey: 'proClients.sort.lastBookingDesc' },
  { value: 'lastBooking-asc', labelKey: 'proClients.sort.lastBookingAsc' },
  { value: 'name-asc', labelKey: 'proClients.sort.nameAsc' },
  { value: 'revenue-desc', labelKey: 'proClients.sort.revenueDesc' },
  { value: 'bookings-desc', labelKey: 'proClients.sort.bookingsDesc' },
];

export default function ClientsScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { provider } = useProvider();
  const insets = useSafeAreaInsets();
  const { clients, loading, error, refresh } = useProviderClients(provider?.id);

  const [search, setSearch] = useState('');
  const [activeTags, setActiveTags] = useState<ProviderClientTag[]>([]);
  const [sort, setSort] = useState<SortKey>('lastBooking-desc');
  const [refreshing, setRefreshing] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [legendSheetOpen, setLegendSheetOpen] = useState(false);
  const [loyaltyOnly, setLoyaltyOnly] = useState(false);

  // Loyalty program — the "Récompense prête" filter chip and the
  // stats line only exist while a valid program is active AND the
  // plan gate passes (mirrors the home-screen block).
  const loyaltySettings = provider?.settings?.loyalty ?? null;
  const loyaltyActive =
    hasLoyaltyAccess(provider) && isLoyaltyConfigValid(loyaltySettings);
  const loyaltyThreshold =
    loyaltyActive && loyaltySettings ? loyaltySettings.threshold : null;

  const loyaltyStats = useMemo(() => {
    if (loyaltyThreshold == null) return null;
    const withCards = clients.filter((c) => (c.loyaltyConfirmedCount ?? 0) > 0);
    const ready = withCards.filter((c) =>
      isLoyaltyRewardArmed(c.loyaltyConfirmedCount ?? 0, loyaltyThreshold),
    ).length;
    return { inProgress: withCards.length, ready };
  }, [clients, loyaltyThreshold]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const toggleTag = (tag: ProviderClientTag) => {
    setActiveTags((tags) =>
      tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    );
  };

  const filtered = useMemo(
    () =>
      applyFilters(
        clients,
        search,
        activeTags,
        sort,
        loyaltyOnly ? loyaltyThreshold : null,
      ),
    [clients, search, activeTags, sort, loyaltyOnly, loyaltyThreshold],
  );

  const sortLabelKey = SORT_OPTIONS.find((o) => o.value === sort)?.labelKey;
  const sortLabel = sortLabelKey ? t(sortLabelKey) : '';

  // ── Loading / error states ─────────────────────────────────────
  if (loading && clients.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Branded blue header — title bar only; the search, tag
          chips and sort toolbar live in their own neutral panel
          below so dark text stays legible. */}
      <BrandedHeader title={t('proClients.title')} />

      {/* Filter / search panel */}
      <View
        style={[
          styles.header,
          {
            paddingTop: spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {/* Search */}
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('proClients.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Tag chips — horizontal scroll keeps them all on one line */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: spacing.sm, paddingBottom: 2 }}
        >
          {TAG_META.map((tag) => {
            const active = activeTags.includes(tag.value);
            return (
              <Pressable
                key={tag.value}
                onPress={() => toggleTag(tag.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active
                      ? colors.primary
                      : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    color: active ? '#fff' : colors.text,
                    fontWeight: '600',
                  }}
                >
                  {tag.shortLabel}
                </Text>
              </Pressable>
            );
          })}
          {loyaltyActive && (
            <Pressable
              onPress={() => setLoyaltyOnly((v) => !v)}
              style={[
                styles.chip,
                {
                  borderColor: loyaltyOnly ? colors.primary : colors.border,
                  backgroundColor: loyaltyOnly
                    ? colors.primary
                    : colors.surfaceSecondary,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                },
              ]}
            >
              <Ionicons
                name="gift-outline"
                size={13}
                color={loyaltyOnly ? '#fff' : colors.text}
              />
              <Text
                variant="caption"
                style={{
                  color: loyaltyOnly ? '#fff' : colors.text,
                  fontWeight: '600',
                }}
              >
                {t('proClients.loyalty.readyFilter')}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setLegendSheetOpen(true)}
            style={[
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor: 'transparent',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
              },
            ]}
          >
            <Ionicons name="help-circle-outline" size={14} color={colors.textMuted} />
            <Text
              variant="caption"
              style={{ color: colors.textMuted, fontWeight: '600' }}
            >
              {t('proClients.understandChip')}
            </Text>
          </Pressable>
        </ScrollView>

        {/* Loyalty stats — compact one-liner at the head of the list */}
        {loyaltyStats && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              marginTop: spacing.sm,
            }}
          >
            <Ionicons name="gift-outline" size={13} color={colors.primary} />
            <Text variant="caption" color="textSecondary">
              {t('proClients.loyalty.cardsInProgress', { count: loyaltyStats.inProgress })}
              {' · '}
              {t('proClients.loyalty.rewardsReady', { count: loyaltyStats.ready })}
            </Text>
          </View>
        )}

        {/* Sort + count */}
        <View style={styles.toolbar}>
          <Text variant="caption" color="textSecondary">
            {filtered.length === clients.length
              ? t('proClients.clientsCount', { count: clients.length })
              : t('proClients.countFiltered', {
                  shown: filtered.length,
                  total: clients.length,
                })}
          </Text>
          <Pressable
            onPress={() => setSortSheetOpen(true)}
            style={({ pressed }) => [
              styles.sortBtn,
              { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="swap-vertical" size={14} color={colors.text} />
            <Text variant="caption" style={{ color: colors.text }}>
              {sortLabel}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* List */}
      {error ? (
        <View style={styles.centered}>
          <Text variant="body" color="textSecondary" style={{ textAlign: 'center', paddingHorizontal: spacing.lg }}>
            {error}
          </Text>
        </View>
      ) : clients.length === 0 ? (
        <EmptyBaseState colors={colors} spacing={spacing} />
      ) : filtered.length === 0 ? (
        <EmptyResultState colors={colors} spacing={spacing} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
          }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <ClientRow
              client={item}
              loyaltyThreshold={loyaltyThreshold}
              onPress={() =>
                router.push({
                  pathname: '/(pro)/client-detail/[key]',
                  params: { key: item.clientKey },
                } as any)
              }
              colors={colors}
              spacing={spacing}
            />
          )}
        />
      )}

      {/* Sort sheet */}
      {sortSheetOpen && (
        <BottomSheet
          title={t('proClients.sortSheetTitle')}
          onClose={() => setSortSheetOpen(false)}
          colors={colors}
          spacing={spacing}
          insets={insets}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sort === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setSort(opt.value);
                  setSortSheetOpen(false);
                }}
                style={({ pressed }) => [
                  styles.sortRow,
                  {
                    backgroundColor: pressed
                      ? colors.surfaceSecondary
                      : 'transparent',
                  },
                ]}
              >
                <Text
                  variant="body"
                  style={{ color: active ? colors.primary : colors.text, fontWeight: active ? '600' : '400' }}
                >
                  {t(opt.labelKey)}
                </Text>
                {active && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </Pressable>
            );
          })}
        </BottomSheet>
      )}

      {/* Legend sheet */}
      {legendSheetOpen && (
        <BottomSheet
          title={t('proClients.legendTitle')}
          onClose={() => setLegendSheetOpen(false)}
          colors={colors}
          spacing={spacing}
          insets={insets}
        >
          <ScrollView style={{ maxHeight: 480 }}>
            {TAG_META.map((tag) => (
              <View key={tag.value} style={{ marginBottom: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Badge label={tag.label} variant={tag.variant} size="sm" />
                </View>
                <Text variant="bodySmall" color="textSecondary">
                  {tag.rule}
                </Text>
              </View>
            ))}
            <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>
              {t('proClients.legendFooter')}
            </Text>
          </ScrollView>
        </BottomSheet>
      )}
    </View>
  );
}

// ─── ClientRow ─────────────────────────────────────────────────────

function ClientRow({
  client,
  loyaltyThreshold,
  onPress,
  colors,
  spacing,
}: {
  client: WithId<ProviderClient>;
  /** Seuil du programme fidélité actif — null = programme inactif. */
  loyaltyThreshold: number | null;
  onPress: () => void;
  colors: any;
  spacing: any;
}) {
  const { t } = useTranslation();
  const fullName = client.name || t('proClients.unnamedClient');
  const lastVisitLabel = formatLastVisitLabel(client.lastBookingAt);

  // Carte de fidélité — visible d'un coup d'œil dans la liste : badge
  // « Prête » ou « 3/10 » + fine jauge de progression sous le résumé.
  const loyaltyCount = client.loyaltyConfirmedCount ?? 0;
  const showLoyalty = loyaltyThreshold != null && loyaltyCount > 0;
  const loyaltyArmed = showLoyalty && isLoyaltyRewardArmed(loyaltyCount, loyaltyThreshold!);
  const loyaltyPos = showLoyalty
    ? loyaltyArmed
      ? loyaltyThreshold!
      : loyaltyCount % loyaltyThreshold!
    : 0;

  // Inline KPI string — much more readable than the previous
  // 3-column layout with "RDV / CA / VU" labels (the bare "VU"
  // was confusing). Order: activity → revenue → recency.
  const rdvPart =
    client.bookingsCount > 0
      ? t('proClients.bookingsShort', { count: client.bookingsCount })
      : t('proClients.noBookings');
  const caPart = formatRevenue(client.totalRevenue);
  const summary = lastVisitLabel
    ? `${rdvPart}  ·  ${caPart}  ·  ${lastVisitLabel}`
    : `${rdvPart}  ·  ${caPart}`;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card padding="md" style={{ opacity: pressed ? 0.85 : 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar
              imageUrl={client.photoURL}
              name={fullName}
              size="md"
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                  {fullName}
                </Text>
                {showLoyalty && (
                  <Badge
                    label={
                      loyaltyArmed
                        ? t('proClients.loyalty.readyBadge')
                        : `${loyaltyPos}/${loyaltyThreshold}`
                    }
                    variant={loyaltyArmed ? 'success' : 'info'}
                    size="sm"
                  />
                )}
                {client.tags.slice(0, 2).map((tag) => {
                  const meta = TAG_META_BY_VALUE[tag];
                  return (
                    <Badge
                      key={tag}
                      label={meta.shortLabel}
                      variant={meta.variant}
                      size="sm"
                    />
                  );
                })}
                {client.tags.length > 2 && (
                  <Badge
                    label={`+${client.tags.length - 2}`}
                    variant="neutral"
                    size="sm"
                  />
                )}
              </View>
              <Text
                variant="bodySmall"
                style={{ color: colors.textSecondary, marginTop: 4 }}
                numberOfLines={1}
              >
                {summary}
              </Text>
              {showLoyalty && (
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    marginTop: 6,
                    overflow: 'hidden',
                    backgroundColor: colors.border,
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      borderRadius: 2,
                      width: `${Math.min(100, Math.round((loyaltyPos / loyaltyThreshold!) * 100))}%`,
                      backgroundColor: loyaltyArmed ? '#16a34a' : colors.primary,
                    }}
                  />
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}

// ─── Empty states ─────────────────────────────────────────────────

function EmptyBaseState({ colors, spacing }: { colors: any; spacing: any }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.centered, { paddingHorizontal: spacing.xl }]}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.primaryLight || '#e4effa',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: spacing.md,
        }}
      >
        <Ionicons name="people-outline" size={28} color={colors.primary} />
      </View>
      <Text variant="h3" style={{ fontWeight: '600', textAlign: 'center', marginBottom: spacing.xs }}>
        {t('proClients.emptyTitle')}
      </Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        {t('proClients.emptyDescription')}
      </Text>
    </View>
  );
}

function EmptyResultState({ colors, spacing }: { colors: any; spacing: any }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.centered, { paddingHorizontal: spacing.xl }]}>
      <Ionicons name="search-outline" size={36} color={colors.textMuted} />
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
        {t('proClients.noResults')}
      </Text>
    </View>
  );
}

// ─── BottomSheet ──────────────────────────────────────────────────

function BottomSheet({
  title,
  onClose,
  children,
  colors,
  spacing,
  insets,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  colors: any;
  spacing: any;
  insets: any;
}) {
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: insets.bottom + spacing.md,
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              marginBottom: spacing.md,
            }}
          />
          <Text variant="h3" style={{ fontWeight: '600', marginBottom: spacing.md }}>
            {title}
          </Text>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function applyFilters(
  base: WithId<ProviderClient>[],
  search: string,
  tags: ProviderClientTag[],
  sort: SortKey,
  /** Loyalty threshold when the "Récompense prête" chip is active —
   *  keeps only clients whose reward is armed. null = filter off. */
  armedThreshold: number | null,
): WithId<ProviderClient>[] {
  const needle = search.trim().toLowerCase();
  let out = base;

  if (needle) {
    out = out.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.email?.toLowerCase().includes(needle) ?? false) ||
        (c.phone?.toLowerCase().includes(needle) ?? false),
    );
  }

  if (tags.length > 0) {
    out = out.filter((c) => c.tags.some((t) => tags.includes(t)));
  }

  if (armedThreshold != null) {
    out = out.filter((c) =>
      isLoyaltyRewardArmed(c.loyaltyConfirmedCount ?? 0, armedThreshold),
    );
  }

  out = [...out];
  switch (sort) {
    case 'lastBooking-desc':
      out.sort((a, b) => b.lastBookingAt.getTime() - a.lastBookingAt.getTime());
      break;
    case 'lastBooking-asc':
      out.sort((a, b) => a.lastBookingAt.getTime() - b.lastBookingAt.getTime());
      break;
    case 'name-asc':
      out.sort((a, b) => a.name.localeCompare(b.name, i18n.language, { sensitivity: 'base' }));
      break;
    case 'revenue-desc':
      out.sort((a, b) => b.totalRevenue - a.totalRevenue);
      break;
    case 'bookings-desc':
      out.sort((a, b) => b.bookingsCount - a.bookingsCount);
      break;
  }
  return out;
}

/**
 * Friendly "last visit" string for the row summary.
 *  - returns null when we have no data (lets the caller drop the
 *    third column entirely instead of showing a misleading "—").
 *  - prefixes with "vu " so the date reads as a sentence inside
 *    the inline summary ("14 RDV · 120 € · vu hier").
 */
function formatLastVisitLabel(d: Date): string | null {
  if (!d || d.getTime() === 0) return null;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Future date — booking ahead. Render the short date with no
  // "vu" prefix so it doesn't read as past.
  if (days < 0) {
    return d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
  }
  if (days === 0) return i18n.t('proClients.lastVisit.today');
  if (days === 1) return i18n.t('proClients.lastVisit.yesterday');
  if (days < 7) return i18n.t('proClients.lastVisit.daysAgo', { count: days });
  if (days < 30) {
    return i18n.t('proClients.lastVisit.weeksAgo', { count: Math.floor(days / 7) });
  }
  // Older — switch to the absolute date, which is more useful past
  // a month than another count of weeks.
  return i18n.t('proClients.lastVisit.onDate', {
    date: d.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    borderBottomWidth: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
});
