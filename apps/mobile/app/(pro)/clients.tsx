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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Card, Avatar, Badge } from '../../components';
import { useProvider } from '../../contexts';
import { useProviderClients } from '../../hooks';
import type { ProviderClient, ProviderClientTag } from '@booking-app/shared';
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

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'lastBooking-desc', label: 'Dernière visite (récent)' },
  { value: 'lastBooking-asc', label: 'Dernière visite (ancien)' },
  { value: 'name-asc', label: 'Nom (A → Z)' },
  { value: 'revenue-desc', label: 'CA cumulé' },
  { value: 'bookings-desc', label: 'Nombre de RDV' },
];

export default function ClientsScreen() {
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
    () => applyFilters(clients, search, activeTags, sort),
    [clients, search, activeTags, sort],
  );

  const sortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '';

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
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.sm,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ fontWeight: '600' }}>
            Clients
          </Text>
          <View style={{ width: 40 }} />
        </View>

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
            placeholder="Rechercher par nom, email, téléphone…"
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
              Comprendre
            </Text>
          </Pressable>
        </ScrollView>

        {/* Sort + count */}
        <View style={styles.toolbar}>
          <Text variant="caption" color="textSecondary">
            {filtered.length === clients.length
              ? `${clients.length} client${clients.length > 1 ? 's' : ''}`
              : `${filtered.length} sur ${clients.length}`}
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
          title="Trier par"
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
                  {opt.label}
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
          title="Comprendre les tags"
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
              Les tags sont rafraîchis à chaque réservation et chaque nuit à 3h. Plusieurs tags peuvent s'appliquer en même temps.
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
  onPress,
  colors,
  spacing,
}: {
  client: WithId<ProviderClient>;
  onPress: () => void;
  colors: any;
  spacing: any;
}) {
  const fullName = client.name || 'Client sans nom';
  const lastVisitLabel = formatLastVisitLabel(client.lastBookingAt);

  // Inline KPI string — much more readable than the previous
  // 3-column layout with "RDV / CA / VU" labels (the bare "VU"
  // was confusing). Order: activity → revenue → recency.
  const rdvPart =
    client.bookingsCount > 0
      ? `${client.bookingsCount} RDV`
      : 'Aucun RDV';
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
        Pas encore de client
      </Text>
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        Dès la première réservation, votre carnet de clients commencera à se remplir automatiquement.
      </Text>
    </View>
  );
}

function EmptyResultState({ colors, spacing }: { colors: any; spacing: any }) {
  return (
    <View style={[styles.centered, { paddingHorizontal: spacing.xl }]}>
      <Ionicons name="search-outline" size={36} color={colors.textMuted} />
      <Text variant="body" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.sm }}>
        Aucun client ne correspond à votre recherche.
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

  out = [...out];
  switch (sort) {
    case 'lastBooking-desc':
      out.sort((a, b) => b.lastBookingAt.getTime() - a.lastBookingAt.getTime());
      break;
    case 'lastBooking-asc':
      out.sort((a, b) => a.lastBookingAt.getTime() - b.lastBookingAt.getTime());
      break;
    case 'name-asc':
      out.sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
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
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  if (days === 0) return "vu aujourd'hui";
  if (days === 1) return 'vu hier';
  if (days < 7) return `vu il y a ${days} j`;
  if (days < 30) return `vu il y a ${Math.floor(days / 7)} sem`;
  // Older — switch to the absolute date, which is more useful past
  // a month than another count of weeks.
  return `vu le ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
